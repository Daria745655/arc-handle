// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
// arc-handle: public profile directory. Claim @name + bio + emoji, others can tip your handle in USDC.
contract ArcHandle {
    struct Profile { address owner; string name; string bio; string emoji; uint256 received; uint256 tips; }
    mapping(bytes32 => uint256) private nameToId; // keccak(lower) => id+1
    mapping(address => uint256) private addrToId; // => id+1
    Profile[] public profiles;
    event Claimed(uint256 indexed id, address indexed owner, string name);
    event Tipped(uint256 indexed id, address indexed from, uint256 amount);

    function claim(string calldata name, string calldata bio, string calldata emoji) external {
        bytes32 k = keccak256(bytes(_lower(name)));
        require(nameToId[k] == 0, "Name taken");
        require(addrToId[msg.sender] == 0, "Already claimed");
        uint256 n = bytes(name).length; require(n >= 3 && n <= 20, "3-20 chars");
        profiles.push(Profile(msg.sender, name, bio, emoji, 0, 0));
        nameToId[k] = profiles.length; addrToId[msg.sender] = profiles.length;
        emit Claimed(profiles.length - 1, msg.sender, name);
    }
    function updateBio(string calldata bio, string calldata emoji) external {
        uint256 idp = addrToId[msg.sender]; require(idp != 0, "No profile");
        profiles[idp - 1].bio = bio; profiles[idp - 1].emoji = emoji;
    }
    function tip(string calldata name) external payable {
        uint256 idp = nameToId[keccak256(bytes(_lower(name)))]; require(idp != 0, "Not found");
        require(msg.value > 0, "Zero");
        Profile storage p = profiles[idp - 1];
        p.received += msg.value; p.tips++;
        (bool ok,) = payable(p.owner).call{value: msg.value}(""); require(ok, "fail");
        emit Tipped(idp - 1, msg.sender, msg.value);
    }
    function byName(string calldata name) external view returns (uint256) { return nameToId[keccak256(bytes(_lower(name)))]; }
    function byAddr(address u) external view returns (uint256) { return addrToId[u]; }
    function get(uint256 id) external view returns (Profile memory) { return profiles[id]; }
    function total() external view returns (uint256) { return profiles.length; }
    function _lower(string memory s) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) { if (b[i] >= 0x41 && b[i] <= 0x5A) b[i] = bytes1(uint8(b[i]) + 32); }
        return string(b);
    }
}
