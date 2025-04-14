import { createContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, createUserDocumentFromAuth } from "../utils/firebase.utils";

// Create the user context
export const UserContext = createContext({
  currentUser: null,
  setCurrentUser: () => null,
});

// User provider component
export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const value = { currentUser, setCurrentUser };

  // Set up the auth state listener when the component mounts
  useEffect(() => {
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Create user document if it doesn't exist
        await createUserDocumentFromAuth(user);
      }
      setCurrentUser(user);
    });

    // Clean up subscription when component unmounts
    return unsubscribe;
  }, []);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
