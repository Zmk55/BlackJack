import React, { useState } from 'react';
import { 
  Server, 
  Shield, 
  Download, 
  Upload, 
  KeyRound,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: () => void;
}

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const { addHost, addGroup } = useAppStore();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Latch',
      description: 'Your secure, local-only SSH manager. No cloud, no sync, just your connections.',
      icon: Server,
    },
    {
      id: 'security',
      title: 'Your Data, Your Control',
      description: 'All data stays on your machine. Export with encryption when you need to backup.',
      icon: Shield,
    },
    {
      id: 'first-host',
      title: 'Add Your First Host',
      description: 'Let\'s add a server to get started. You can always add more later.',
      icon: KeyRound,
      action: async () => {
        const name = prompt('Enter a name for your server (e.g., "My Server"):');
        if (!name) return;
        
        const hostname = prompt('Enter the hostname or IP address:');
        if (!hostname) return;
        
        const portStr = prompt('Enter the SSH port (default 22):') || '22';
        const port = parseInt(portStr, 10) || 22;
        
        await addHost({
          name,
          hostname,
          port,
          auth: 'agent',
          tags: [],
        });
      }
    },
    {
      id: 'import-export',
      title: 'Backup & Restore',
      description: 'Export your vault with a password to backup or share securely.',
      icon: Download,
    },
    {
      id: 'ready',
      title: 'You\'re All Set!',
      description: 'Start managing your SSH connections. Press Cmd/Ctrl+K for the command palette.',
      icon: CheckCircle,
    }
  ];

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  const handleNext = () => {
    if (currentStepData.action) {
      currentStepData.action();
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    setCurrentStep(steps.length - 1);
  };

  if (currentStep >= steps.length) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl p-8">
          {/* Progress */}
          <div className="flex justify-center mb-6">
            <div className="flex gap-2">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-2xl font-semibold mb-2">
              {currentStepData.title}
            </h2>
            
            <p className="text-muted-foreground">
              {currentStepData.description}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            {currentStep < steps.length - 1 && (
              <Button
                variant="outline"
                onClick={handleSkip}
                className="flex-1"
              >
                Skip
              </Button>
            )}
            
            <Button
              onClick={handleNext}
              className="flex-1"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
              {currentStep < steps.length - 1 && (
                <ArrowRight className="w-4 h-4 ml-2" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
