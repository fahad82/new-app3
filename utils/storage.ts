// authStorage.ts
import * as SecureStore from 'expo-secure-store';

const KEY_EMAIL = 'auth_email';
const KEY_PASSWORD = 'auth_password';
const KEY_ROLE = 'auth_role';
const KEY_IS_LOGGED_IN = 'auth_logged_in';

export const authStorage = {
  async saveCredentials(email: string, pass: string, remember: boolean, role: string) {
    try {
      await SecureStore.setItemAsync(KEY_EMAIL, email);
      await SecureStore.setItemAsync(KEY_PASSWORD, pass);
      await SecureStore.setItemAsync(KEY_ROLE, role);
      await SecureStore.setItemAsync(KEY_IS_LOGGED_IN, 'true');
    } catch (e) {
      console.error("Error saving credentials", e);
    }
  },

  async isLoggedIn(): Promise<boolean> {
    const status = await SecureStore.getItemAsync(KEY_IS_LOGGED_IN);
    return status === 'true';
  },

  async getEmail(): Promise<string | null> {
    return await SecureStore.getItemAsync(KEY_EMAIL);
  },

  async getRole(): Promise<string | null> {
    return await SecureStore.getItemAsync(KEY_ROLE);
  },

  async logout() {
    try {
      await SecureStore.deleteItemAsync(KEY_IS_LOGGED_IN);
      await SecureStore.deleteItemAsync(KEY_ROLE);
      // Optionally keep email/pass if you want to pre-fill the login form later
    } catch (e) {
      console.error("Error destroying session", e);
    }
  }
};