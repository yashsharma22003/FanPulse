// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title FanPulse soulbound skill-tier NFT
/// @notice One token per wallet. Mirrors `challengeRating` tiers. Not transferable.
/// @dev Animated SVG metadata is generated on-chain in tokenURI (SMIL). Some explorers show a static frame.
contract FanNFT {
    enum Tier {
        Rookie,
        Scout,
        Analyst,
        Expert,
        Oracle
    }

    error FanNFTNonexistent();
    error FanNFTNonTransferable();
    error FanNFTNotOwner();
    error FanNFTInvalidReceiver();

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event TierUpdated(address indexed wallet, uint256 indexed tokenId, Tier newTier);

    string public constant name = "FanPulse Fan NFT";
    string public constant symbol = "FANPULSE";

    address public owner;
    uint256 public nextTokenId = 1;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => Tier) public tierOf;
    mapping(address => uint256) public tokenOfWallet;

    modifier onlyOwner() {
        if (msg.sender != owner) revert FanNFTNotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert FanNFTInvalidReceiver();
        owner = newOwner;
    }

    /// @notice Mint on first Scout+ sync; later calls update tier in place (including demotion to Rookie).
    function setTier(address wallet, Tier newTier) external onlyOwner {
        if (wallet == address(0)) revert FanNFTInvalidReceiver();
        uint256 tokenId = tokenOfWallet[wallet];
        if (tokenId == 0) {
            tokenId = nextTokenId++;
            tokenOfWallet[wallet] = tokenId;
            _mint(wallet, tokenId);
        }
        tierOf[tokenId] = newTier;
        emit TierUpdated(wallet, tokenId, newTier);
    }

    function balanceOf(address wallet) public view returns (uint256) {
        return _balances[wallet];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address o = _owners[tokenId];
        if (o == address(0)) revert FanNFTNonexistent();
        return o;
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        if (_owners[tokenId] == address(0)) revert FanNFTNonexistent();
        Tier tier = tierOf[tokenId];
        string memory t = _tierName(tier);
        string memory svg = _buildSvg(tier, t);
        string memory json = string.concat(
            '{"name":"FanPulse ',
            t,
            '","description":"Soulbound FanPulse skill identity. Non-transferable.",',
            '"image":"data:image/svg+xml;base64,',
            _base64(bytes(svg)),
            '","attributes":[{"trait_type":"Tier","value":"',
            t,
            '"}]}'
        );
        return string.concat("data:application/json;base64,", _base64(bytes(json)));
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f || interfaceId == 0x01ffc9a7;
    }

    function transferFrom(address, address, uint256) external pure {
        revert FanNFTNonTransferable();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert FanNFTNonTransferable();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert FanNFTNonTransferable();
    }

    function approve(address, uint256) external pure {
        revert FanNFTNonTransferable();
    }

    function setApprovalForAll(address, bool) external pure {
        revert FanNFTNonTransferable();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function _mint(address to, uint256 tokenId) internal {
        _owners[tokenId] = to;
        unchecked {
            _balances[to] += 1;
        }
        emit Transfer(address(0), to, tokenId);
    }

    function _tierName(Tier t) internal pure returns (string memory) {
        if (t == Tier.Scout) return "Scout";
        if (t == Tier.Analyst) return "Analyst";
        if (t == Tier.Expert) return "Expert";
        if (t == Tier.Oracle) return "Oracle";
        return "Rookie";
    }

    function _palette(Tier t)
        internal
        pure
        returns (string memory bg, string memory mid, string memory accent, string memory glow)
    {
        if (t == Tier.Oracle) return ("#0a0612", "#2a1040", "#ff6b4a", "#c8ff4d");
        if (t == Tier.Expert) return ("#0e0c22", "#25204a", "#ffc857", "#ff6b4a");
        if (t == Tier.Analyst) return ("#081420", "#123550", "#4de8d0", "#c8ff4d");
        if (t == Tier.Scout) return ("#0a1812", "#163828", "#c8ff4d", "#7ae32d");
        return ("#0c0e14", "#1a2030", "#8b95ad", "#5a6478");
    }

    function _buildSvg(Tier tier, string memory label) internal pure returns (string memory) {
        (string memory bg, string memory mid, string memory accent, string memory glow) = _palette(tier);
        return string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" shape-rendering="crispEdges">',
            "<defs>",
            '<radialGradient id="bg" cx="50%" cy="35%" r="80%">',
            '<stop offset="0%" stop-color="',
            mid,
            '"/><stop offset="100%" stop-color="',
            bg,
            '"/></radialGradient>',
            '<radialGradient id="spot" cx="50%" cy="68%" r="50%">',
            '<stop offset="0%" stop-color="',
            accent,
            '" stop-opacity="0.45"/><stop offset="100%" stop-color="',
            accent,
            '" stop-opacity="0"/></radialGradient>',
            '<filter id="heroGlow" x="-60%" y="-60%" width="220%" height="220%">',
            '<feGaussianBlur stdDeviation="12" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>',
            "</filter>",
            "</defs>",
            '<rect width="512" height="512" fill="url(#bg)"/>',
            '<ellipse cx="256" cy="368" rx="170" ry="64" fill="url(#spot)">',
            '<animate attributeName="rx" values="150;190;150" dur="2.2s" repeatCount="indefinite"/>',
            '<animate attributeName="ry" values="54;72;54" dur="2.2s" repeatCount="indefinite"/>',
            "</ellipse>",
            '<line x1="64" y1="398" x2="448" y2="398" stroke="',
            accent,
            '" stroke-width="2" opacity="0.2"/>',
            _orbitPixels(accent, uint8(tier)),
            _pixelCharacter(tier, accent, glow),
            '<text x="256" y="40" text-anchor="middle" fill="',
            accent,
            '" font-family="monospace" font-size="10" letter-spacing="9" opacity="0.75">FANPULSE</text>',
            _tierFooter(label, accent, tier),
            "</svg>"
        );
    }

    function _tierFooter(string memory label, string memory accent, Tier tier) internal pure returns (string memory) {
        string memory rank;
        if (tier == Tier.Oracle) rank = "V";
        else if (tier == Tier.Expert) rank = "IV";
        else if (tier == Tier.Analyst) rank = "III";
        else if (tier == Tier.Scout) rank = "II";
        else rank = "I";
        return string.concat(
            '<rect x="88" y="416" width="336" height="62" rx="18" fill="#00000066" stroke="',
            accent,
            '" stroke-width="2"/>',
            '<text x="256" y="446" text-anchor="middle" fill="#f4f0e6" font-family="sans-serif" font-size="30" font-weight="800">',
            label,
            "</text>",
            '<text x="256" y="468" text-anchor="middle" fill="',
            accent,
            '" font-family="monospace" font-size="10" letter-spacing="2">SOULBOUND',
            " &#8226; RANK ",
            rank,
            "</text>"
        );
    }

    function _orbitPixels(string memory accent, uint8 tier) internal pure returns (string memory) {
        if (tier < 1) return "";
        string memory dur = tier >= 4 ? "5s" : "7s";
        return string.concat(
            '<g transform="translate(256,278)">',
            "<g>",
            '<animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="',
            dur,
            '" repeatCount="indefinite"/>',
            '<rect x="-98" y="-4" width="6" height="6" fill="',
            accent,
            '" opacity="0.9">',
            '<animate attributeName="opacity" values="0.4;1;0.4" dur="1.1s" repeatCount="indefinite"/>',
            "</rect>",
            '<rect x="88" y="10" width="5" height="5" fill="',
            accent,
            '" opacity="0.7"/>',
            "</g>",
            "<g>",
            '<animateTransform attributeName="transform" type="rotate" from="180" to="540" dur="',
            dur,
            '" repeatCount="indefinite"/>',
            '<rect x="80" y="-78" width="5" height="5" fill="',
            accent,
            '"/>',
            '<rect x="-90" y="66" width="4" height="4" fill="',
            accent,
            '" opacity="0.6"/>',
            "</g></g>"
        );
    }

    function _str(uint8 v) internal pure returns (string memory) {
        if (v < 10) {
            bytes memory b = new bytes(1);
            b[0] = bytes1(uint8(48 + v));
            return string(b);
        }
        bytes memory b2 = new bytes(2);
        b2[0] = bytes1(uint8(48 + v / 10));
        b2[1] = bytes1(uint8(48 + v % 10));
        return string(b2);
    }

    function _r(uint8 x, uint8 y, string memory c) internal pure returns (string memory) {
        uint16 px = uint16(x) * 2;
        uint16 py = uint16(y) * 2;
        return string.concat(
            "<rect x=\"",
            _strU16(px),
            "\" y=\"",
            _strU16(py),
            "\" width=\"2\" height=\"2\" fill=\"",
            c,
            "\"/>"
        );
    }

    function _strU16(uint16 v) internal pure returns (string memory) {
        if (v < 10) {
            bytes memory b = new bytes(1);
            b[0] = bytes1(uint8(48 + v));
            return string(b);
        }
        if (v < 100) {
            bytes memory b2 = new bytes(2);
            b2[0] = bytes1(uint8(48 + v / 10));
            b2[1] = bytes1(uint8(48 + v % 10));
            return string(b2);
        }
        bytes memory b3 = new bytes(3);
        b3[0] = bytes1(uint8(48 + v / 100));
        b3[1] = bytes1(uint8(48 + (v / 10) % 10));
        b3[2] = bytes1(uint8(48 + v % 10));
        return string(b3);
    }

    function _pixelCharacter(Tier tier, string memory accent, string memory glow) internal pure returns (string memory) {
        (string memory f1, string memory f2, string memory f3) = _charFrames(tier, accent, glow);
        return _animChar(f1, f2, f3, uint8(tier), accent);
    }

    function _animChar(string memory f1, string memory f2, string memory f3, uint8 tier, string memory /* accent */)
        internal
        pure
        returns (string memory)
    {
        string memory cycle = tier >= 4 ? "0.72s" : (tier >= 2 ? "0.9s" : "1.05s");
        return string.concat(
            '<g transform="translate(136,124)" filter="url(#heroGlow)">',
            '<ellipse cx="120" cy="252" rx="68" ry="14" fill="#000" opacity="0.45">',
            '<animate attributeName="rx" values="56;78;56" dur="0.65s" repeatCount="indefinite"/>',
            '<animate attributeName="opacity" values="0.35;0.55;0.35" dur="0.65s" repeatCount="indefinite"/>',
            "</ellipse>",
            '<g transform="scale(12)">',
            "<g>",
            '<animateTransform attributeName="transform" type="translate" values="0,0;1.2,0;0,-0.35;-1.2,0;0,0" dur="1.6s" repeatCount="indefinite"/>',
            "<g>",
            '<animateTransform attributeName="transform" type="translate" values="0,0;0,-1.8;0,0" dur="0.65s" repeatCount="indefinite"/>',
            '<animateTransform attributeName="transform" type="scale" additive="sum" values="1,1;1.05,0.95;1,1" dur="0.65s" repeatCount="indefinite"/>',
            "<g>",
            f1,
            '<animate attributeName="opacity" values="1;0;0;1" dur="',
            cycle,
            '" repeatCount="indefinite"/>',
            "</g>",
            '<g opacity="0">',
            f2,
            '<animate attributeName="opacity" values="0;1;0;0" dur="',
            cycle,
            '" repeatCount="indefinite"/>',
            "</g>",
            '<g opacity="0">',
            f3,
            '<animate attributeName="opacity" values="0;0;1;0" dur="',
            cycle,
            '" repeatCount="indefinite"/>',
            "</g>",
            "</g></g></g></g>"
        );
    }

    function _charFrames(Tier tier, string memory accent, string memory glow)
        internal
        pure
        returns (string memory f1, string memory f2, string memory f3)
    {
        if (tier == Tier.Oracle) return _charOracle(accent, glow);
        if (tier == Tier.Expert) return _charExpert(accent, glow);
        if (tier == Tier.Analyst) return _charAnalyst(accent, glow);
        if (tier == Tier.Scout) return _charScout(accent, glow);
        return _charRookie(accent);
    }

    function _charRookie(string memory accent) internal pure returns (string memory f1, string memory f2, string memory f3) {
        string memory skin = "#e8c4a8";
        string memory eye = "#1a1a2e";
        string memory hood = "#5a6478";
        string memory shoe = "#3a4254";
        f1 = string.concat(
            _r(3, 0, hood),
            _r(4, 0, hood),
            _r(5, 0, hood),
            _r(6, 0, hood),
            _r(2, 1, hood),
            _r(3, 1, hood),
            _r(4, 1, hood),
            _r(5, 1, hood),
            _r(6, 1, hood),
            _r(7, 1, hood),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(3, 4, hood),
            _r(4, 4, hood),
            _r(5, 4, hood),
            _r(6, 4, hood),
            _r(2, 5, hood),
            _r(3, 5, hood),
            _r(4, 5, hood),
            _r(5, 5, hood),
            _r(6, 5, hood),
            _r(7, 5, hood),
            _r(3, 6, hood),
            _r(4, 6, hood),
            _r(5, 6, hood),
            _r(6, 6, hood),
            _r(3, 7, hood),
            _r(6, 7, hood),
            _r(3, 8, hood),
            _r(4, 8, hood),
            _r(5, 8, hood),
            _r(6, 8, hood),
            _r(3, 9, accent),
            _r(6, 9, accent),
            _r(3, 10, shoe),
            _r(6, 10, shoe)
        );
        f2 = string.concat(
            _r(3, 0, hood),
            _r(4, 0, hood),
            _r(5, 0, hood),
            _r(6, 0, hood),
            _r(2, 1, hood),
            _r(3, 1, hood),
            _r(4, 1, hood),
            _r(5, 1, hood),
            _r(6, 1, hood),
            _r(7, 1, hood),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(3, 4, hood),
            _r(4, 4, hood),
            _r(5, 4, hood),
            _r(6, 4, hood),
            _r(2, 5, hood),
            _r(3, 5, hood),
            _r(4, 5, hood),
            _r(5, 5, hood),
            _r(6, 5, hood),
            _r(7, 5, hood),
            _r(3, 6, hood),
            _r(4, 6, hood),
            _r(5, 6, hood),
            _r(6, 6, hood),
            _r(2, 7, hood),
            _r(7, 7, hood),
            _r(2, 8, hood),
            _r(7, 8, hood),
            _r(2, 9, accent),
            _r(7, 9, accent),
            _r(2, 10, shoe),
            _r(7, 10, shoe)
        );
        f3 = f1;
    }

    function _charScout(string memory accent, string memory glow)
        internal
        pure
        returns (string memory f1, string memory f2, string memory f3)
    {
        string memory skin = "#e8c4a8";
        string memory eye = "#1a1a2e";
        string memory shirt = "#163828";
        string memory shoe = "#0a1812";
        f1 = string.concat(
            _r(4, 0, accent),
            _r(5, 0, accent),
            _r(3, 1, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(6, 1, accent),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 4, shirt),
            _r(3, 4, shirt),
            _r(4, 4, accent),
            _r(5, 4, accent),
            _r(6, 4, shirt),
            _r(7, 4, shirt),
            _r(2, 5, shirt),
            _r(3, 5, shirt),
            _r(4, 5, shirt),
            _r(5, 5, shirt),
            _r(6, 5, shirt),
            _r(7, 5, shirt),
            _r(3, 6, shirt),
            _r(4, 6, glow),
            _r(5, 6, glow),
            _r(6, 6, shirt),
            _r(3, 7, shirt),
            _r(6, 7, shirt),
            _r(2, 8, accent),
            _r(3, 8, skin),
            _r(6, 8, skin),
            _r(7, 8, accent),
            _r(2, 9, shoe),
            _r(3, 9, shoe),
            _r(6, 9, shoe),
            _r(7, 9, shoe)
        );
        f2 = string.concat(
            _r(4, 0, accent),
            _r(5, 0, accent),
            _r(3, 1, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(6, 1, accent),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 4, shirt),
            _r(3, 4, shirt),
            _r(4, 4, accent),
            _r(5, 4, accent),
            _r(6, 4, shirt),
            _r(7, 4, shirt),
            _r(2, 5, shirt),
            _r(3, 5, shirt),
            _r(4, 5, shirt),
            _r(5, 5, shirt),
            _r(6, 5, shirt),
            _r(7, 5, shirt),
            _r(3, 6, shirt),
            _r(4, 6, glow),
            _r(5, 6, glow),
            _r(6, 6, shirt),
            _r(3, 7, shirt),
            _r(6, 7, shirt),
            _r(3, 8, skin),
            _r(4, 8, accent),
            _r(5, 8, accent),
            _r(6, 8, skin),
            _r(3, 9, shoe),
            _r(4, 9, shoe),
            _r(5, 9, shoe),
            _r(6, 9, shoe)
        );
        f3 = string.concat(
            _r(4, 0, accent),
            _r(5, 0, accent),
            _r(3, 1, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(6, 1, accent),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 3, accent),
            _r(7, 3, accent),
            _r(2, 4, shirt),
            _r(3, 4, shirt),
            _r(4, 4, accent),
            _r(5, 4, accent),
            _r(6, 4, shirt),
            _r(7, 4, shirt),
            _r(3, 5, shirt),
            _r(4, 5, glow),
            _r(5, 5, glow),
            _r(6, 5, shirt),
            _r(3, 6, shirt),
            _r(6, 6, shirt),
            _r(4, 7, shirt),
            _r(5, 7, shirt),
            _r(4, 8, shoe),
            _r(5, 8, shoe)
        );
    }

    function _charAnalyst(string memory accent, string memory glow)
        internal
        pure
        returns (string memory f1, string memory f2, string memory f3)
    {
        string memory skin = "#e8c4a8";
        string memory eye = "#1a1a2e";
        string memory coat = "#123550";
        string memory screen = "#081420";
        f1 = string.concat(
            _r(2, 1, accent),
            _r(7, 1, accent),
            _r(3, 0, accent),
            _r(6, 0, accent),
            _r(3, 1, skin),
            _r(4, 1, skin),
            _r(5, 1, skin),
            _r(6, 1, skin),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 4, coat),
            _r(3, 4, coat),
            _r(4, 4, accent),
            _r(5, 4, accent),
            _r(6, 4, coat),
            _r(7, 4, coat),
            _r(2, 5, coat),
            _r(3, 5, coat),
            _r(4, 5, coat),
            _r(5, 5, coat),
            _r(6, 5, coat),
            _r(7, 5, coat),
            _r(1, 6, screen),
            _r(2, 6, glow),
            _r(3, 6, screen),
            _r(4, 6, accent),
            _r(5, 6, coat),
            _r(6, 6, coat),
            _r(1, 7, screen),
            _r(2, 7, accent),
            _r(3, 7, screen),
            _r(4, 7, coat),
            _r(5, 7, coat),
            _r(3, 8, coat),
            _r(6, 8, coat),
            _r(3, 9, accent),
            _r(6, 9, accent),
            _r(3, 10, accent),
            _r(6, 10, accent)
        );
        f2 = string.concat(
            _r(2, 1, accent),
            _r(7, 1, accent),
            _r(3, 0, accent),
            _r(6, 0, accent),
            _r(3, 1, skin),
            _r(4, 1, skin),
            _r(5, 1, skin),
            _r(6, 1, skin),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 4, coat),
            _r(3, 4, coat),
            _r(4, 4, accent),
            _r(5, 4, accent),
            _r(6, 4, coat),
            _r(7, 4, coat),
            _r(2, 5, coat),
            _r(3, 5, coat),
            _r(4, 5, coat),
            _r(5, 5, coat),
            _r(6, 5, coat),
            _r(7, 5, coat),
            _r(1, 6, screen),
            _r(2, 6, accent),
            _r(3, 6, screen),
            _r(4, 6, coat),
            _r(5, 6, glow),
            _r(6, 6, coat),
            _r(1, 7, screen),
            _r(2, 7, glow),
            _r(3, 7, screen),
            _r(4, 7, coat),
            _r(5, 7, coat),
            _r(2, 8, coat),
            _r(7, 8, coat),
            _r(2, 9, accent),
            _r(7, 9, accent),
            _r(2, 10, accent),
            _r(7, 10, accent)
        );
        f3 = f1;
    }

    function _charExpert(string memory accent, string memory glow)
        internal
        pure
        returns (string memory f1, string memory f2, string memory f3)
    {
        string memory skin = "#e8c4a8";
        string memory eye = "#1a1a2e";
        string memory suit = "#25204a";
        string memory cape = "#ffc857";
        f1 = string.concat(
            _r(1, 3, cape),
            _r(8, 3, cape),
            _r(1, 4, cape),
            _r(8, 4, cape),
            _r(1, 5, cape),
            _r(8, 5, cape),
            _r(4, 0, accent),
            _r(5, 0, accent),
            _r(3, 1, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(6, 1, accent),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(3, 4, suit),
            _r(4, 4, glow),
            _r(5, 4, glow),
            _r(6, 4, suit),
            _r(2, 5, suit),
            _r(3, 5, suit),
            _r(4, 5, suit),
            _r(5, 5, suit),
            _r(6, 5, suit),
            _r(7, 5, suit),
            _r(7, 6, accent),
            _r(3, 6, suit),
            _r(4, 6, accent),
            _r(5, 6, suit),
            _r(6, 6, suit),
            _r(3, 7, suit),
            _r(6, 7, suit),
            _r(3, 8, suit),
            _r(6, 8, suit),
            _r(2, 9, accent),
            _r(3, 9, accent),
            _r(6, 9, accent),
            _r(7, 9, accent)
        );
        f2 = string.concat(
            _r(1, 2, cape),
            _r(8, 2, cape),
            _r(1, 3, cape),
            _r(8, 3, cape),
            _r(1, 4, cape),
            _r(8, 4, cape),
            _r(1, 5, cape),
            _r(8, 5, cape),
            _r(4, 0, accent),
            _r(5, 0, accent),
            _r(3, 1, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(6, 1, accent),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(3, 4, suit),
            _r(4, 4, glow),
            _r(5, 4, glow),
            _r(6, 4, suit),
            _r(2, 5, suit),
            _r(3, 5, suit),
            _r(4, 5, suit),
            _r(5, 5, suit),
            _r(6, 5, suit),
            _r(7, 5, suit),
            _r(2, 6, accent),
            _r(3, 6, suit),
            _r(4, 6, suit),
            _r(5, 6, accent),
            _r(6, 6, suit),
            _r(3, 7, suit),
            _r(6, 7, suit),
            _r(3, 8, suit),
            _r(6, 8, suit),
            _r(3, 9, accent),
            _r(4, 9, accent),
            _r(5, 9, accent),
            _r(6, 9, accent)
        );
        f3 = f1;
    }

    function _charOracle(string memory accent, string memory glow)
        internal
        pure
        returns (string memory f1, string memory f2, string memory f3)
    {
        string memory skin = "#e8c4a8";
        string memory eye = "#c8ff4d";
        string memory robe = "#2a1040";
        string memory staff = "#ff6b4a";
        f1 = string.concat(
            _r(3, 0, accent),
            _r(4, 0, glow),
            _r(5, 0, glow),
            _r(6, 0, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 4, robe),
            _r(3, 4, robe),
            _r(4, 4, glow),
            _r(5, 4, glow),
            _r(6, 4, robe),
            _r(7, 4, robe),
            _r(2, 5, robe),
            _r(3, 5, robe),
            _r(4, 5, robe),
            _r(5, 5, robe),
            _r(6, 5, robe),
            _r(7, 5, robe),
            _r(8, 3, staff),
            _r(8, 4, staff),
            _r(8, 5, glow),
            _r(8, 6, staff),
            _r(8, 7, staff),
            _r(3, 6, robe),
            _r(6, 6, robe),
            _r(2, 7, robe),
            _r(7, 7, robe),
            _r(3, 8, accent),
            _r(6, 8, accent),
            _r(2, 9, glow),
            _r(7, 9, glow)
        );
        f2 = string.concat(
            _r(3, 0, accent),
            _r(4, 0, glow),
            _r(5, 0, glow),
            _r(6, 0, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, skin),
            _r(6, 2, skin),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 4, robe),
            _r(3, 4, robe),
            _r(4, 4, glow),
            _r(5, 4, glow),
            _r(6, 4, robe),
            _r(7, 4, robe),
            _r(2, 5, robe),
            _r(3, 5, robe),
            _r(4, 5, robe),
            _r(5, 5, robe),
            _r(6, 5, robe),
            _r(7, 5, robe),
            _r(8, 2, staff),
            _r(8, 3, staff),
            _r(8, 4, glow),
            _r(8, 5, staff),
            _r(8, 6, staff),
            _r(3, 6, robe),
            _r(6, 6, robe),
            _r(3, 7, robe),
            _r(6, 7, robe),
            _r(3, 8, accent),
            _r(6, 8, accent),
            _r(3, 9, glow),
            _r(6, 9, glow)
        );
        f3 = string.concat(
            _r(3, 0, accent),
            _r(4, 0, glow),
            _r(5, 0, glow),
            _r(6, 0, accent),
            _r(4, 1, accent),
            _r(5, 1, accent),
            _r(1, 2, staff),
            _r(3, 2, skin),
            _r(4, 2, eye),
            _r(5, 2, eye),
            _r(6, 2, skin),
            _r(9, 2, glow),
            _r(4, 3, skin),
            _r(5, 3, skin),
            _r(2, 4, robe),
            _r(3, 4, robe),
            _r(4, 4, glow),
            _r(5, 4, glow),
            _r(6, 4, robe),
            _r(7, 4, robe),
            _r(3, 5, robe),
            _r(4, 5, robe),
            _r(5, 5, robe),
            _r(6, 5, robe),
            _r(8, 4, staff),
            _r(8, 5, staff),
            _r(4, 6, robe),
            _r(5, 6, robe),
            _r(3, 7, accent),
            _r(6, 7, accent),
            _r(4, 8, glow),
            _r(5, 8, glow)
        );
    }

    /// @dev Minimal Base64 (RFC 4648) for tokenURI.
    function _base64(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        string memory table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        bytes memory tab = bytes(table);
        uint256 i;
        uint256 j;
        while (i < data.length) {
            uint256 a = uint8(data[i]);
            uint256 b = i + 1 < data.length ? uint8(data[i + 1]) : 0;
            uint256 c = i + 2 < data.length ? uint8(data[i + 2]) : 0;
            result[j] = tab[a >> 2];
            result[j + 1] = tab[((a & 3) << 4) | (b >> 4)];
            result[j + 2] = i + 1 < data.length ? tab[((b & 15) << 2) | (c >> 6)] : bytes1("=");
            result[j + 3] = i + 2 < data.length ? tab[c & 63] : bytes1("=");
            unchecked {
                i += 3;
                j += 4;
            }
        }
        return string(result);
    }
}
