import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Wrench, Mail, Lock, User, UserPlus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const Login = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({ 
    email: '', 
    password: '', 
    name: '', 
    role: 'technician' 
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginData.email, loginData.password);
      toast.success('¡Bienvenido!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(registerData);
      toast.success('Cuenta creada exitosamente. Inicia sesión.');
      setLoginData({ email: registerData.email, password: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear cuenta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ 
          backgroundImage: 'url(https://images.pexels.com/photos/13625784/pexels-photo-13625784.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940)' 
        }}
      >
        <div className="absolute inset-0 bg-black/60"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="flex items-center gap-3 mb-6">
            <Wrench size={40} strokeWidth={1.5} />
            <h1 className="text-4xl font-bold tracking-tight">ServiceTech</h1>
          </div>
          <p className="text-xl text-zinc-200 max-w-md leading-relaxed">
            Sistema de gestión para servicios técnicos de telefonía. Controla reparaciones, inventario y clientes en un solo lugar.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wrench size={32} className="text-blue-600" />
              <h1 className="text-3xl font-bold tracking-tight">ServiceTech</h1>
            </div>
            <p className="text-sm text-zinc-600">Sistema de Gestión</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
              <TabsTrigger value="login" data-testid="login-tab">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="register" data-testid="register-tab">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-sm font-medium text-zinc-900">Email</Label>
                  <div className="mt-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="login-email-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="login-password" className="text-sm font-medium text-zinc-900">Contraseña</Label>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="login-password-input"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium mt-6"
                  data-testid="login-submit-button"
                >
                  {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                </Button>

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-xs text-blue-900 font-medium mb-1">Cuentas de prueba:</p>
                  <p className="text-xs text-blue-700">admin@servicetec.com / Admin123!</p>
                  <p className="text-xs text-blue-700">tecnico@servicetec.com / Tecnico123!</p>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-name" className="text-sm font-medium text-zinc-900">Nombre Completo</Label>
                  <div className="mt-1 relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Juan Pérez"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="register-name-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-email" className="text-sm font-medium text-zinc-900">Email</Label>
                  <div className="mt-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="usuario@ejemplo.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="register-email-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-password" className="text-sm font-medium text-zinc-900">Contraseña</Label>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      className="pl-10 border-zinc-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      required
                      data-testid="register-password-input"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-role" className="text-sm font-medium text-zinc-900">Rol</Label>
                  <Select
                    value={registerData.role}
                    onValueChange={(value) => setRegisterData({ ...registerData, role: value })}
                  >
                    <SelectTrigger className="mt-1 border-zinc-200" data-testid="register-role-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="technician">Técnico</SelectItem>
                      <SelectItem value="receptionist">Recepcionista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium mt-6"
                  data-testid="register-submit-button"
                >
                  {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Login;
