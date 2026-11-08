import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/infrastructure/repositories/api';

const AuthContext = createContext(null);

export function fixMojibake(str) {
  if (!str || typeof str !== 'string') return str;
  if (/[\u00C2-\u00C5\u00E1\u00E2\u00EA\u00F4][\u0080-\u00BF]/.test(str) || str.includes('Ã') || str.includes('Æ')) {
    try {
      const bytes = Uint8Array.from([...str].map(c => c.charCodeAt(0)));
      const decoded = new TextDecoder('utf-8').decode(bytes);
      if (decoded && !decoded.includes('')) return decoded;
    } catch (e) {
      return str;
    }
  }
  return str;
}

function sanitizeUser(userData) {
  if (!userData) return userData;
  return {
    ...userData,
    fullName: fixMojibake(userData.fullName),
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Khôi phục trạng thái đăng nhập từ localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    const initAuth = async () => {
      if (savedToken && savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          const cleanUser = sanitizeUser(parsed);
          setToken(savedToken);
          setUser(cleanUser);
          localStorage.setItem('user', JSON.stringify(cleanUser));
        } catch (e) {
          console.error("Lỗi đọc user cache:", e);
        }
        
        try {
          const res = await authAPI.getProfile();
          if (res.data.success) {
            const userData = sanitizeUser(res.data.data);
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (err) {
          console.error("Lỗi đồng bộ profile:", err);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = (userData, jwtToken) => {
    const cleanUser = sanitizeUser(userData);
    setUser(cleanUser);
    setToken(jwtToken);
    localStorage.setItem('token', jwtToken);
    localStorage.setItem('user', JSON.stringify(cleanUser));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const fetchUserProfile = async () => {
    try {
      const res = await authAPI.getProfile();
      if (res.data.success) {
        const userData = sanitizeUser(res.data.data);
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (err) {
      console.error("Lỗi cập nhật profile:", err);
    }
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, fetchUserProfile, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
