import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../../utils/supabase';

interface User {
    id: number;
    username: string;
    name: string;
    role: 'admin' | 'operator';
}

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check authentication status on mount
    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            // Check localStorage first - this is our primary auth source
            const storedUser = localStorage.getItem('trolley_user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                setIsLoading(false);
                return;
            }
        } catch (error) {
            console.error('Auth check error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
        try {
            if (!username || !password) {
                return { success: false, error: 'Username dan password harus diisi' };
            }

            // Call Supabase RPC function to verify login securely
            const { data, error } = await supabase.rpc('verify_user_login', {
                p_username: username,
                p_password: password,
            });

            if (error) {
                console.error('Login RPC error:', error);
                return { success: false, error: 'Tidak dapat terhubung ke server' };
            }

            // RPC returns an array of matching rows
            if (!data || data.length === 0) {
                return { success: false, error: 'Username atau password salah' };
            }

            const userRow = data[0];
            const userData: User = {
                id: userRow.user_id,
                username: userRow.user_username,
                name: userRow.user_name,
                role: userRow.user_role as 'admin' | 'operator',
            };

            setUser(userData);
            localStorage.setItem('trolley_user', JSON.stringify(userData));
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Tidak dapat terhubung ke server' };
        }
    };

    const logout = async () => {
        setUser(null);
        localStorage.removeItem('trolley_user');
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                login,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
