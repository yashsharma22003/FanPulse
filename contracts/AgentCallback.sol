// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Receives Somnia Agents consensus callbacks and emits the decoded integer.
/// FanPulse polls getRequest as well; this contract exists so the platform callback
/// does not revert (an EOA callback would).
contract AgentCallback {
    enum ConsensusType {
        Majority,
        Threshold
    }

    enum ResponseStatus {
        None,
        Pending,
        Success,
        Failed,
        TimedOut
    }

    struct Response {
        address validator;
        bytes result;
        ResponseStatus status;
        uint256 receipt;
        uint256 timestamp;
        uint256 executionCost;
    }

    struct Request {
        uint256 id;
        address requester;
        address callbackAddress;
        bytes4 callbackSelector;
        address[] subcommittee;
        Response[] responses;
        uint256 responseCount;
        uint256 failureCount;
        uint256 threshold;
        uint256 createdAt;
        uint256 deadline;
        ResponseStatus status;
        ConsensusType consensusType;
        uint256 remainingBudget;
        uint256 perAgentBudget;
    }

    address public immutable platform;

    event InferenceResult(uint256 indexed requestId, int256 value);
    event InferenceFailed(uint256 indexed requestId, uint8 status);

    error OnlyPlatform();

    constructor(address platform_) {
        platform = platform_;
    }

    function handleResponse(
        uint256 requestId,
        Response[] memory responses,
        ResponseStatus status,
        Request memory
    ) external {
        if (msg.sender != platform) revert OnlyPlatform();
        if (status != ResponseStatus.Success || responses.length == 0) {
            emit InferenceFailed(requestId, uint8(status));
            return;
        }
        int256 value = abi.decode(responses[0].result, (int256));
        emit InferenceResult(requestId, value);
    }

    receive() external payable {}
}
