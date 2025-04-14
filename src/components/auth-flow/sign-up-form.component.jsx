import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAuthUserWithEmailAndPassword,
  createUserDocumentFromAuth,
  signInWithGooglePopup,
} from "../../utils/firebase.utils";

const defaultFormFields = {
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

const SignUpForm = ({ toggleView, onSignUpSuccess }) => {
  const [formFields, setFormFields] = useState(defaultFormFields);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const { displayName, email, password, confirmPassword } = formFields;

  const resetFormFields = () => {
    setFormFields(defaultFormFields);
    setErrorMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const userCredential = await createAuthUserWithEmailAndPassword(
        email,
        password
      );

      await createUserDocumentFromAuth(userCredential.user, { displayName });

      resetFormFields();

      if (onSignUpSuccess) {
        // Small delay to ensure auth state is updated before navigation
        setTimeout(() => {
          onSignUpSuccess();
        }, 500);
      } else {
        setTimeout(() => {
          navigate("/profile");
        }, 500);
      }
    } catch (error) {
      console.error("Error in sign-up process:", error);

      if (error.code === "auth/email-already-in-use") {
        setErrorMessage("Cannot create user, email already in use");
      } else {
        setErrorMessage(`Sign-up error: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormFields({ ...formFields, [name]: value });
  };

  const signUpWithGoogle = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      console.log("Attempting Google sign-up");
      const result = await signInWithGooglePopup();

      // Small delay to ensure auth state is updated before navigation
      setTimeout(() => {
        if (onSignUpSuccess) {
          onSignUpSuccess();
        } else {
          navigate("/profile");
        }
      }, 500);
    } catch (error) {
      console.error("Error in Google sign-up:", error);
      setErrorMessage(`Google sign-up error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1 className="auth-title">Sign Up</h1>

      {errorMessage && <div className="auth-error">{errorMessage}</div>}

      <div className="auth-buttons">
        <button
          className="auth-button google-button"
          onClick={signUpWithGoogle}
          disabled={isLoading}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {isLoading ? "Signing up..." : "Sign Up With Google"}
        </button>
      </div>

      <div className="auth-divider">OR</div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="displayName">Display Name</label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={displayName}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={email}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={password}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
        </div>
        <button type="submit" className="auth-button" disabled={isLoading}>
          {isLoading ? "Signing Up..." : "Sign Up"}
        </button>
      </form>

      <div className="auth-switch">
        Already have an account?{" "}
        <button
          className="text-button"
          onClick={toggleView}
          disabled={isLoading}
        >
          Sign In
        </button>
      </div>
    </>
  );
};

export default SignUpForm;
