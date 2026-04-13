import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Lock, User, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError('Username dan password harus diisi');
            return;
        }

        setIsLoading(true);
        const result = await login(username, password);
        setIsLoading(false);

        if (!result.success) {
            setError(result.error || 'Login gagal');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-teal-50 via-white to-white flex flex-col items-center justify-center p-4">
            {/* Logo */}
            <div className="mb-6">
                <img
                    src="/logo-aerofood.png"
                    alt="Aerofood ACS Logo"
                    className="h-28 w-auto object-contain"
                />
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold text-gray-800 mb-2 tracking-wide">TROLLEY MAINTENANCE</h1>
            <p className="text-gray-500 mb-8">Sistem Manajemen Maintenance Trolley</p>

            {/* Login Card */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-semibold text-gray-800">Selamat Datang</h2>
                    <p className="text-gray-500 mt-1">Silakan login untuk melanjutkan</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Username Field */}
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                            Username
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <User className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                                placeholder="Masukkan username"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Lock className="h-5 w-5 text-gray-400" />
                            </div>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 bg-white"
                                placeholder="Masukkan password"
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 bg-green-500 text-white font-semibold rounded-full hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Memproses...
                            </>
                        ) : (
                            'Login'
                        )}
                    </button>
                </form>
            </div>

            {/* Copyright */}
            <p className="text-center text-gray-400 text-sm mt-8">
                © 2026 Aerofood ACS - Garuda Indonesia Group
            </p>
        </div>
    );
}
