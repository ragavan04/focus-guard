import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../contexts/user.context";
import { signOut } from "firebase/auth";
import { auth, db, uploadProfilePicture } from "../../utils/firebase.utils";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../../styles/auth.css";

const UserProfile = () => {
  const { currentUser } = useContext(UserContext);
  const [userData, setUserData] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const navigate = useNavigate();

  // Check for authentication and redirect if not authenticated
  useEffect(() => {
    if (!currentUser) {
      console.log("No user authenticated, redirecting to sign-in");
      navigate("/sign-in");
    }
  }, [currentUser, navigate]);

  // Fetch user data from Firestore when component mounts
  useEffect(() => {
    const fetchUserData = async () => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          const userSnapshot = await getDoc(userDocRef);

          if (userSnapshot.exists()) {
            setUserData(userSnapshot.data());
          } else {
            // If no document exists, use auth data
            setUserData({
              displayName: currentUser.displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL,
            });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };

    fetchUserData();
  }, [currentUser]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/sign-in");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file (JPEG or PNG).");
      return;
    }

    // Check file size (limit to 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Image size should be less than 2MB.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // Upload the file and get the download URL
      await uploadProfilePicture(file);

      // Update local state with the new photo URL
      setUserData((prevData) => ({
        ...prevData,
        photoURL: currentUser.photoURL,
      }));
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      setUploadError("Failed to upload profile picture. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!currentUser || !userData) {
    return (
      <div className="auth-page">
        <div className="auth-container">Loading...</div>
      </div>
    );
  }

  // Use userData for display, falling back to currentUser when needed
  const displayName =
    userData.displayName || currentUser.displayName || "Not set";
  const email = userData.email || currentUser.email;
  const photoURL = userData.photoURL || currentUser.photoURL;

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1 className="auth-title">Your Profile</h1>

        <div className="profile-content">
          <div className="profile-avatar">
            {photoURL ? (
              <img src={photoURL} alt="Profile" />
            ) : (
              <div className="profile-initial">
                {displayName !== "Not set"
                  ? displayName.charAt(0).toUpperCase()
                  : email.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="profile-picture-upload">
              <label htmlFor="profile-picture-input" className="upload-button">
                Change Picture
              </label>
              <input
                type="file"
                id="profile-picture-input"
                accept="image/*"
                onChange={handleProfilePictureUpload}
                disabled={isUploading}
                style={{ display: "none" }}
              />
              {isUploading && <div className="upload-status">Uploading...</div>}
              {uploadError && <div className="upload-error">{uploadError}</div>}
            </div>
          </div>

          <div className="profile-details">
            <div className="profile-field">
              <label>Name</label>
              <div className="profile-value">{displayName}</div>
            </div>

            <div className="profile-field">
              <label>Email</label>
              <div className="profile-value">{email}</div>
            </div>

            <button onClick={handleSignOut} className="auth-button">
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
