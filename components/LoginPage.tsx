// src/components/LoginPage.tsx
import React, { useState } from 'react';
// ... (các import khác giữ nguyên)

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, lang, onToggleLang }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const t = translations[lang];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || t.loginError);
      }

      // Đăng nhập thành công với dữ liệu từ MongoDB
      onLogin({ username: data.username, role: data.role, email: data.email });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ... (Phần render giữ nguyên, thêm trạng thái Loading cho nút Submit)
