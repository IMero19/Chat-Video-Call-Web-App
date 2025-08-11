import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js";

export async function getRecommendedUsers(req, res) {
  try {
    const currentUserId = req.user.id;
    const currenUser = req.user;

    const recommendedUsers = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, //exclude current user
        { _id: { $nin: currenUser.friends } }, // exclude current user's friends
        { isOnboarded: true }, // should be onboarded
      ],
    });
    res.status(200).json(recommendedUsers);
  } catch (error) {
    console.error("Error in getRecommendedUsers controller", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
}

export async function getMyFriends(req, res) {
  try {
    const user = await User.findById(req.user.id)
      .select("friends")
      .populate(
        "friends",
        "fullName profilePic nativeLanguage learningLanguage"
      );

    res.status(200).json(user.friends);
  } catch (error) {
    console.error("Error in getMyFriends controller", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
}

export async function sendFriendRequest(req, res) {
  try {
    const senderId = req.user.id;
    const { id: recipientId } = req.params;

    // prevend sending req to yourself
    if (senderId === recipientId) {
      return res
        .status(400)
        .json({ msg: "You can't send a friend request to yourself!" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ msg: "Recipient not found" });
    }
    // Check if user is already friends
    if (recipient.friends.includes(senderId)) {
      return res
        .status(400)
        .json({ msg: "You are already friends with this user" });
    }

    // Check if a req already exists
    const existingRequset = await FriendRequest.findOne({
      $or: [
        { sender: senderId, recipient: recipientId },
        { sender: recipientId, recipient: senderId },
      ],
    });

    if (existingRequset) {
      return res.status(400).json({
        msg: "A Friend request already exists between you and this user!",
      });
    }

    const friendRequest = await FriendRequest.create({
      sender: senderId,
      recipient: recipientId,
    });

    res.status(201).json(friendRequest);
  } catch (error) {
    console.error("Error in sendFriendRequest controller", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
}

export async function acceptFriendRequest(req, res) {
  try {
    const { id: requestId } = req.params;
    const friendRequest = await FriendRequest.findById(requestId);

    if (!friendRequest) {
      return res.status(404).json({ msg: "Friend request not found" });
    }

    // Verify the current user is the recipient
    if (friendRequest.recipient.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ msg: "You are not authorized to accept this request" });
    }

    friendRequest.status = "accepted";
    await friendRequest.save();

    // add each user to the other's friends list
    // $addToSet: adds elements to an array if they do not already exist
    await User.findByIdAndUpdate(friendRequest.sender, {
      $addToSet: { friends: friendRequest.recipient },
    });

    await User.findByIdAndUpdate(friendRequest.recipient, {
      $addToSet: { friends: friendRequest.sender },
    });

    res.status(200).json({ msg: "Friend request accepted!" });
  } catch (error) {
    console.error("Error in acceptFriendRequest Controller", error.message);
    res.status(500).json({ msg: "Internal Server Error" });
  }
}

export async function getFriendRequests(req, res) {
  try {
    const currentUserId = req.user.id;
    const incomingReqs = await FriendRequest.find({
      recipient: currentUserId,
      status: "pending",
    }).populate(
      "sender",
      "fullName nativeLanguage learningLanguage profilePic"
    );

    const acceptedReqs = await FriendRequest.find({
      sender: currentUserId,
      status: "accepted",
    }).populate("recipient", "fullName profilePic");

    res.status(200).json({ incomingReqs, acceptedReqs });
  } catch (error) {
    console.error("Error in getFriendRequests Controller", error.message);
    res.status(500).json({ msg: "Internal Server Error" });
  }
}

export async function getOutgoingFriendRequests(req, res) {
  try {
    const outgoingReqs = await FriendRequest.find({
      sender: req.user.id,
      status: "pending",
    }).populate(
      "recipient",
      "fullName profilePic nativeLanguage learningLanguage"
    );

    res.status(200).json(outgoingReqs);
  } catch (error) {
    console.error(
      "Error in getOutgoingFriendRequests Controller",
      error.message
    );
    res.status(500).json({ msg: "Internal Server Error" });
  }
}

export async function getIncomingFriendRequests(req, res) {
  try {
    const incomingReqs = await FriendRequest.find({
      recipient: req.user.id,
      status: "pending",
    }).populate(
      "sender",
      "fullName profilePic nativeLanguage learningLanguage"
    );

    res.status(200).json(incomingReqs);
  } catch (error) {
    console.error(
      "Error in getIncomingFriendRequests Controller",
      error.message
    );
    res.status(500).json({ msg: "Internal Server Error" });
  }
}
