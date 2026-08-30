import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { generateNonce, SiweMessage } from 'siwe';
import { getAddress, verifyMessage } from 'viem';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async issueNonce() {
    await this.prisma.authNonce.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    const nonce = generateNonce();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.prisma.authNonce.create({ data: { nonce, expiresAt } });
    return {
      nonce,
      domain: this.config.getOrThrow<string>('siweDomain'),
      uri: this.config.getOrThrow<string>('siweUri'),
      chainId: this.config.getOrThrow<number>('chainId'),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async login(message: string, signature: string) {
    let siwe: SiweMessage;
    try {
      siwe = new SiweMessage(message);
    } catch {
      throw new BadRequestException('Invalid SIWE message');
    }

    const expectedDomain = this.config.getOrThrow<string>('siweDomain');
    const expectedChainId = this.config.getOrThrow<number>('chainId');
    if (siwe.domain !== expectedDomain) {
      throw new UnauthorizedException('SIWE domain mismatch');
    }
    if (siwe.chainId !== expectedChainId) {
      throw new UnauthorizedException('SIWE chain mismatch');
    }

    const stored = await this.prisma.authNonce.findUnique({
      where: { nonce: siwe.nonce },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    const valid = await verifyMessage({
      address: getAddress(siwe.address),
      message: siwe.prepareMessage(),
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      throw new UnauthorizedException('Invalid signature');
    }

    await this.prisma.authNonce.delete({ where: { nonce: siwe.nonce } });

    const wallet = getAddress(siwe.address).toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { wallet },
      create: { wallet },
      update: {},
    });

    const token = await this.jwt.signAsync({
      sub: user.id,
      wallet: user.wallet,
    });
    return { token, user: this.serializeUser(user) };
  }

  serializeUser(user: {
    id: string;
    wallet: string;
    challengeEnergy: { toString(): string };
    challengeRating: number;
    wins: number;
    losses: number;
  }) {
    return {
      id: user.id,
      wallet: user.wallet,
      challengeEnergy: user.challengeEnergy.toString(),
      challengeRating: user.challengeRating,
      wins: user.wins,
      losses: user.losses,
    };
  }
}
