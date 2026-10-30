import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth0 } from '@auth0/auth0-react';

// --- TYPE DEFINITIONS ---

/** Defines the structure of the data stored in the context. */
interface UserData {
  email: string;
  firstName: string;
  lastName: string;
}

/** Defines the minimal shape of the Auth0 user object fields we rely on. */
interface Auth0User {
  email?: string;
  given_name?: string;
  family_name?: string;
  // ... other Auth0 user properties would go here
}

/** Defines the expected return type of the useAuth0 hook. */
interface Auth0HookValue {
  isAuthenticated: boolean;
  user?: Auth0User;
  isLoading: boolean;
  // ... other Auth0 hook properties
}

// Initialize the context with a default value matching the UserData structure
const initialUserData: UserData = { email: "", firstName: "", lastName: "" };
const UserContext = createContext<UserData>(initialUserData);

// --- PROVIDER COMPONENT ---

interface UserProviderProps {
  children: ReactNode;
}

export function UserProvider({ children }: UserProviderProps) {
  // We use the mocked hook here, but it assumes the structure of the real one
  const { isAuthenticated, user, isLoading } = useAuth0();
  const [userData, setUserData] = useState<UserData>(initialUserData);

  useEffect(() => {
    if (isAuthenticated && user && !isLoading) {
      // Use nullish coalescing operators (??) or optional chaining with default
      // to ensure all UserData fields are non-null strings as defined in the interface.
      setUserData({
        email: user.email ?? "",
        firstName: user.given_name ?? "",
        lastName: user.family_name ?? "",
      });
    } else {
      // Reset user data on logout or if the state is not ready/authenticated
      setUserData(initialUserData);
    }
  }, [isAuthenticated, user, isLoading]);

  return <UserContext.Provider value={userData}>{children}</UserContext.Provider>;
}

// --- CUSTOM HOOK ---

export const useUser = (): UserData => {
  return useContext(UserContext);
};
