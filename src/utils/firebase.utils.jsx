import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithRedirect,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword as signInAuthWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
};

const firebaseApp = initializeApp(firebaseConfig);

const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({ prompt: "select_account" });

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();

// Add a listener to log auth state changes during development
if (process.env.NODE_ENV !== "production") {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("Auth state changed: User is signed in", user.uid);
    } else {
      console.log("Auth state changed: User is signed out");
    }
  });
}

export const signInWithGooglePopup = async () => {
  try {
    console.log("Attempting Google sign-in...");
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log("Google sign-in successful for user:", user.uid);

    // Ensure the user document is created with display name
    await createUserDocumentFromAuth(user);

    return result;
  } catch (error) {
    console.error("Error with Google sign-in:", error);
    throw error;
  }
};

export const signInWithGoogleRedirect = () =>
  signInWithRedirect(auth, googleProvider);

export const createUserDocumentFromAuth = async (
  userAuth,
  additionalInformation = {}
) => {
  if (!userAuth) {
    console.error("No user auth object provided");
    return;
  }

  const userDocRef = doc(db, "users", userAuth.uid);

  try {
    const userSnapshot = await getDoc(userDocRef);

    if (!userSnapshot.exists()) {
      console.log("Creating new user document for:", userAuth.uid);
      const { displayName, email } = userAuth;
      const createdAt = new Date();

      try {
        await setDoc(userDocRef, {
          displayName,
          email,
          createdAt,
          ...additionalInformation,
        });
        console.log("User document created successfully");
      } catch (error) {
        console.error("Error creating user document:", error.message);
      }
    } else {
      console.log("User document already exists:", userAuth.uid);
    }

    return userDocRef;
  } catch (error) {
    console.error("Error checking user document:", error);
    return null;
  }
};

export const createAuthUserWithEmailAndPassword = async (email, password) => {
  if (!email || !password) {
    console.error("Email and password are required");
    return;
  }

  try {
    console.log("Creating user with email and password...");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    console.log("User created successfully:", result.user.uid);
    return result;
  } catch (error) {
    console.error("Error creating user with email and password:", error);
    throw error;
  }
};

export const signInWithEmailAndPassword = async (email, password) => {
  if (!email || !password) {
    console.error("Email and password are required");
    return;
  }

  try {
    console.log("Signing in with email and password...");
    const result = await signInAuthWithEmailAndPassword(auth, email, password);
    console.log("Sign in successful for user:", result.user.uid);
    return result;
  } catch (error) {
    console.error("Error signing in with email and password:", error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
    console.log("User signed out successfully");
    return true;
  } catch (error) {
    console.error("Error signing out:", error);
    return false;
  }
};

// Function to upload profile picture and update user profile
export const uploadProfilePicture = async (file) => {
  if (!auth.currentUser) {
    throw new Error("User must be logged in to upload a profile picture");
  }

  try {
    // Create a unique file name using user ID and timestamp
    const fileExtension = file.name.split(".").pop();
    const fileName = `profile-pictures/${
      auth.currentUser.uid
    }_${Date.now()}.${fileExtension}`;
    const storageRef = ref(storage, fileName);

    // Upload the file to Firebase Storage
    const snapshot = await uploadBytes(storageRef, file);
    console.log("File uploaded successfully");

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log("File available at", downloadURL);

    // Update user profile in Firebase Auth
    await updateProfile(auth.currentUser, {
      photoURL: downloadURL,
    });
    console.log("User profile updated with new photo URL");

    // Also update the user document in Firestore
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userDocRef, { photoURL: downloadURL });
    console.log("User document updated with new photo URL");

    return downloadURL;
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    throw error;
  }
};

// Friend request functions
export const sendFriendRequest = async (recipientEmail) => {
  if (!auth.currentUser) {
    throw new Error("You must be logged in to send a friend request");
  }

  try {
    // Get the current user details
    const currentUser = auth.currentUser;

    // Check if trying to add self
    if (currentUser.email === recipientEmail) {
      throw new Error("You cannot send a friend request to yourself");
    }

    // Query to find the user with the provided email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", recipientEmail));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("No user found with that email address");
    }

    const recipientUser = querySnapshot.docs[0];
    const recipientId = recipientUser.id;

    // Check if a friend request already exists
    const friendRequestsRef = collection(db, "friendRequests");
    const existingRequestQuery = query(
      friendRequestsRef,
      where("senderId", "==", currentUser.uid),
      where("recipientId", "==", recipientId)
    );
    const existingRequestSnapshot = await getDocs(existingRequestQuery);

    if (!existingRequestSnapshot.empty) {
      throw new Error("You already sent a friend request to this user");
    }

    // Check if they are already friends
    const userDocRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      const userData = userDoc.data();
      if (userData.friends && userData.friends.includes(recipientId)) {
        throw new Error("You are already friends with this user");
      }
    }

    // Create a new friend request
    await addDoc(friendRequestsRef, {
      senderId: currentUser.uid,
      senderEmail: currentUser.email,
      senderName: currentUser.displayName || "",
      recipientId,
      recipientEmail,
      status: "pending",
      createdAt: new Date(),
    });

    return { success: true, message: "Friend request sent successfully" };
  } catch (error) {
    console.error("Error sending friend request:", error);
    throw error;
  }
};

export const getFriendRequests = async () => {
  if (!auth.currentUser) {
    throw new Error("You must be logged in to view friend requests");
  }

  try {
    const currentUser = auth.currentUser;

    // Get requests received
    const receivedRequestsRef = collection(db, "friendRequests");
    const receivedQuery = query(
      receivedRequestsRef,
      where("recipientId", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    const receivedSnapshot = await getDocs(receivedQuery);

    const receivedRequests = receivedSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: "received",
    }));

    // Get requests sent
    const sentRequestsRef = collection(db, "friendRequests");
    const sentQuery = query(
      sentRequestsRef,
      where("senderId", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    const sentSnapshot = await getDocs(sentQuery);

    const sentRequests = sentSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      type: "sent",
    }));

    return {
      received: receivedRequests,
      sent: sentRequests,
    };
  } catch (error) {
    console.error("Error getting friend requests:", error);
    throw error;
  }
};

export const respondToFriendRequest = async (requestId, accept) => {
  if (!auth.currentUser) {
    throw new Error("You must be logged in to respond to friend requests");
  }

  try {
    const currentUser = auth.currentUser;

    // Get the friend request
    const requestRef = doc(db, "friendRequests", requestId);
    const requestDoc = await getDoc(requestRef);

    if (!requestDoc.exists()) {
      throw new Error("Friend request not found");
    }

    const requestData = requestDoc.data();

    // Verify the current user is the recipient
    if (requestData.recipientId !== currentUser.uid) {
      throw new Error("You can only respond to requests sent to you");
    }

    if (accept) {
      // Add each user to the other's friends list
      const currentUserRef = doc(db, "users", currentUser.uid);
      const senderRef = doc(db, "users", requestData.senderId);

      // Add friend to current user's friends list
      await updateDoc(currentUserRef, {
        friends: arrayUnion(requestData.senderId),
      });

      // Add current user to sender's friends list
      await updateDoc(senderRef, {
        friends: arrayUnion(currentUser.uid),
      });

      // Update request status to accepted
      await updateDoc(requestRef, {
        status: "accepted",
      });
    } else {
      // Delete the request if rejected
      await deleteDoc(requestRef);
    }

    return {
      success: true,
      message: accept ? "Friend request accepted" : "Friend request rejected",
    };
  } catch (error) {
    console.error("Error responding to friend request:", error);
    throw error;
  }
};

export const removeFriend = async (friendId) => {
  if (!auth.currentUser) {
    throw new Error("You must be logged in to remove a friend");
  }

  try {
    const currentUser = auth.currentUser;

    // Remove the friend from current user's friends list
    const currentUserRef = doc(db, "users", currentUser.uid);
    await updateDoc(currentUserRef, {
      friends: arrayRemove(friendId),
    });

    // Remove current user from friend's friends list
    const friendRef = doc(db, "users", friendId);
    await updateDoc(friendRef, {
      friends: arrayRemove(currentUser.uid),
    });

    return {
      success: true,
      message: "Friend removed successfully",
    };
  } catch (error) {
    console.error("Error removing friend:", error);
    throw error;
  }
};

export const getFriends = async () => {
  if (!auth.currentUser) {
    throw new Error("You must be logged in to view friends");
  }

  try {
    const currentUser = auth.currentUser;

    // Get the current user document
    const userRef = doc(db, "users", currentUser.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error("User document not found");
    }

    const userData = userDoc.data();
    const friends = userData.friends || [];

    // Get details for each friend
    const friendDetails = await Promise.all(
      friends.map(async (friendId) => {
        const friendRef = doc(db, "users", friendId);
        const friendDoc = await getDoc(friendRef);

        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          return {
            id: friendId,
            displayName: friendData.displayName || "User",
            email: friendData.email,
            photoURL: friendData.photoURL || null,
          };
        }
        return null;
      })
    );

    // Filter out any null values (friends that couldn't be found)
    return friendDetails.filter((friend) => friend !== null);
  } catch (error) {
    console.error("Error getting friends:", error);
    throw error;
  }
};
