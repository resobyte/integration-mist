'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/common/Input';
import { Button } from '@/components/common/Button';
import { useToast } from '@/components/common/ToastContext';
import { apiPatch } from '@/lib/api';
import { AuthUser } from '@/types';

interface AccountFormProps {
  user: AuthUser;
}

export function AccountForm({ user }: AccountFormProps) {
  const router = useRouter();
  const { showSuccess, showDanger } = useToast();
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    startTransition(async () => {
      try {
        await apiPatch(`/users/${user.id}`, {
          firstName,
          lastName,
          email,
        });
        showSuccess('Profile updated successfully');
        router.refresh();
      } catch (error) {
        showDanger(error instanceof Error ? error.message : 'Failed to update profile');
      }
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      showDanger('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      showDanger('Password must be at least 8 characters');
      return;
    }

    startTransition(async () => {
      try {
        await apiPatch(`/users/${user.id}`, {
          password: newPassword,
        });
        showSuccess('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (error) {
        showDanger(error instanceof Error ? error.message : 'Failed to update password');
      }
    });
  };

  return (
    <div className="space-y-8">

      <form onSubmit={handleProfileSubmit} className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="First Name"
            name="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <Input
            label="Last Name"
            name="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <Input
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Button type="submit" isLoading={isPending}>
            Update Profile
          </Button>
        </div>
      </form>

      <hr className="border-border" />

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground">Change Password</h3>
        <Input
          label="Current Password"
          type="password"
          name="currentPassword"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
        <Input
          label="New Password"
          type="password"
          name="newPassword"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <Input
          label="Confirm New Password"
          type="password"
          name="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        <div className="flex justify-end">
          <Button type="submit" isLoading={isPending}>
            Update Password
          </Button>
        </div>
      </form>
    </div>
  );
}
