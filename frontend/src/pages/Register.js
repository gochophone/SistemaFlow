import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Wrench, Building2, User, Mail, Lock, ArrowRight } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company_name: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validations
    if (!formData.name || !formData.email || !formData.company_name || !formData.password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/register`, {
        name: formData.name,
        email: formData.email,
        company_name: formData.company_name,
        password: formData.password
      });

      toast.success('¡Registro exitoso! Redirigiendo al inicio de sesión...');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Error al registrar usuario';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-3xl"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="flex items-center gap-3 mb-6">
            <Wrench size={40} strokeWidth={1.5} />
            <h1 className="text-4xl font-bold tracking-tight">TechFlow</h1>
          </div>
          <p className="text-xl text-zinc-200 max-w-md leading-relaxed mb-8">
            Sistema de gestión para servicios técnicos de telefonía. Controla reparaciones, inventario y clientes en un solo lugar.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold">✓</span>
              </div>
              <div>
                <p className="font-semibold">Gestión de Reparaciones</p>
                <p className="text-sm text-zinc-400">Seguimiento completo de órdenes</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold">✓</span>
              </div>
              <div>
                <p className="font-semibold">Control de Inventario</p>
                <p className="text-sm text-zinc-400">Stock y repuestos actualizados</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-400 font-bold">✓</span>
              </div>
              <div>
                <p className="font-semibold">Base de Datos de Clientes</p>
                <p className="text-sm text-zinc-400">Historial completo de servicios</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Register Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
              <Wrench size={32} className="text-blue-600" />
              <h1 className="text-3xl font-bold tracking-tight">TechFlow</h1>
            </div>
            <CardTitle className="text-2xl text-center">Crear Cuenta</CardTitle>
            <p className="text-sm text-zinc-600 text-center">
              Regístrate para comenzar a gestionar tu servicio técnico
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company_name" className="text-sm font-medium text-zinc-900">
                  <Building2 size={16} className="inline mr-2" />
                  Nombre de la Empresa
                </Label>
                <Input
                  id="company_name"
                  name="company_name"
                  type="text"
                  placeholder="Ej: TechService SpA"
                  value={formData.company_name}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-zinc-900">
                  <User size={16} className="inline mr-2" />
                  Tu Nombre
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-zinc-900">
                  <Mail size={16} className="inline mr-2" />
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@empresa.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-zinc-900">
                  <Lock size={16} className="inline mr-2" />
                  Contraseña
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium text-zinc-900">
                  <Lock size={16} className="inline mr-2" />
                  Confirmar Contraseña
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold"
                disabled={loading}
              >
                {loading ? (
                  'Registrando...'
                ) : (
                  <>
                    Crear Cuenta
                    <ArrowRight size={18} className="ml-2" />
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-zinc-600 mt-4">
                ¿Ya tienes una cuenta?{' '}
                <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold">
                  Iniciar Sesión
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;
