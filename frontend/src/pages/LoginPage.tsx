import React, { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardContent, CardHeader } from '../components/ui/Card';

const LoginPage: React.FC = () => {
  const { sendEmailOTP, verifyEmailOTP, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1); // 1: Email step, 2: OTP step
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!email) {
      setError('Please enter your email');
      setIsSubmitting(false);
      return;
    }

    const success = await sendEmailOTP(email);
    if (success) {
      setStep(2);
    } else {
      setError('Failed to send OTP. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!otp) {
      setError('Please enter the OTP');
      setIsSubmitting(false);
      return;
    }

    const success = await verifyEmailOTP(email, otp);
    if (!success) {
      setError('Invalid OTP. Please try again.');
    }
    setIsSubmitting(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <LockKeyhole className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {step === 1 ? 'Login with OTP' : 'Verify OTP'}
          </h1>
          <p className="text-slate-600">
            {step === 1
              ? 'Enter your email to receive an OTP'
              : 'Enter the OTP sent to your email'}
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={step === 1 ? handleSendOTP : handleVerifyOTP} className="space-y-4">
            {step === 1 && (
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            )}

            {step === 2 && (
              <Input
                label="OTP"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter the OTP"
                required
              />
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              isLoading={isSubmitting}
              disabled={step === 1 ? !email : !otp}
            >
              {step === 1
                ? (isSubmitting ? 'Sending OTP...' : 'Send OTP')
                : (isSubmitting ? 'Verifying...' : 'Verify OTP')}
            </Button>

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Resend OTP
              </button>
            )}
          </form>

          <div className="text-center text-sm text-slate-600">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;