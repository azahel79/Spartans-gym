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
    await login(form.email, form.password);
  }, [login, form.email, form.password]);

  return {
    form,
    errors,
    loading,
    handleChange,
    handleSubmit
  };
};