// hooks/auth/useAuth.ts
import { useState, useCallback } from 'react';
import { useAuthStore } from '../../store/auth.store';

export const useAuth = () => {
  const { login, loading, errors, setErrors } = useAuthStore();
  
  const [form, setForm] = useState({
    email: '',
    password: ''
  });

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Limpiar error del campo cuando el usuario escribe
    if (errors[name as keyof typeof errors]) {
      setErrors({ ...errors, [name]: undefined });
    }
  }, [errors, setErrors]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const nextErrors: { email?: string; password?: string } = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Ingresa un correo válido';
    if (!form.password || form.password.length > 128) nextErrors.password = 'Ingresa una contraseña válida';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    await login(email, form.password);
  }, [login, form.email, form.password, setErrors]);

  return {
    form,
    errors,
    loading,
    handleChange,
    handleSubmit
  };
};
