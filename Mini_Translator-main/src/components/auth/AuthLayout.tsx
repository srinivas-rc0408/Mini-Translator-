import React from 'react';
import { motion } from 'motion/react';
import { Languages } from 'lucide-react';
import InteractiveNeuralVortex from '../ui/interactive-neural-vortex-background';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  return (
    <InteractiveNeuralVortex>
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden"
        >
          <div className="p-8 pb-0 text-center">
            <div className="inline-flex p-3 bg-indigo-500/20 rounded-2xl mb-6">
              <Languages className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
            {subtitle && <p className="text-sm text-white/60">{subtitle}</p>}
          </div>
          
          <div className="p-8 text-white">
            {children}
          </div>
          
          <div className="p-8 pt-0 text-center">
            <p className="text-xs text-white/40">
              Powered by MiniTranslator AI &bull; Secure Access
            </p>
          </div>
        </motion.div>
      </div>
    </InteractiveNeuralVortex>
  );
};
