'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/common/Modal';
import { Input } from '@/components/common/Input';
import { Select } from '@/components/common/Select';
import { useToast } from '@/components/common/ToastContext';
import { apiGetPaginated, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { User, Role, PaginationMeta, SortConfig } from '@/types';

interface UserFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
}

const initialFormData: UserFormData = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: Role.OPERATION,
  isActive: true,
};

export function UsersTable() {
  const { showSuccess, showDanger } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | undefined>();
  const [sortConfig, setSortConfig] = useState<SortConfig>({ sortBy: 'createdAt', sortOrder: 'DESC' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>(initialFormData);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiGetPaginated<User>('/users', {
        params: {
          page: currentPage,
          limit: 10,
          sortBy: sortConfig.sortBy,
          sortOrder: sortConfig.sortOrder,
        },
      });
      setUsers(response.data);
      setPagination(response.meta);
    } catch {
      console.error('Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, sortConfig]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      sortBy: key,
      sortOrder: prev.sortBy === key && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC',
    }));
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData(initialFormData);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError('');

    try {
      if (editingUser) {
        const updateData: Partial<UserFormData> = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
        }
        await apiPatch(`/users/${editingUser.id}`, updateData);
        showSuccess('User updated successfully');
      } else {
        await apiPost('/users', formData);
        showSuccess('User created successfully');
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setFormError(errorMessage);
      showDanger(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (user: User) => {
    if (!confirm(`Are you sure you want to delete ${user.firstName} ${user.lastName}?`)) {
      return;
    }

    try {
      await apiDelete(`/users/${user.id}`);
      showSuccess('User deleted successfully');
      fetchUsers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user';
      showDanger(errorMessage);
    }
  };

  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();
    return (
      user.firstName.toLowerCase().includes(lowerTerm) ||
      user.lastName.toLowerCase().includes(lowerTerm) ||
      user.email.toLowerCase().includes(lowerTerm) ||
      user.role.toLowerCase().includes(lowerTerm)
    );
  });

  const columns = [
    { key: 'firstName', label: 'User' },
    { key: 'role', label: 'Role' },
    { key: 'isActive', label: 'Status' },
    { key: 'createdAt', label: 'Last Login' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground font-rubik">Users</h2>
          <p className="text-muted-foreground mt-1">Manage user access and permissions.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center shadow-md transition-all active:scale-95"
        >
          <svg className="w-[18px] h-[18px] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center">
          <div className="relative w-full max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-muted/20 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {columns.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-6 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{label}</span>
                      {sortConfig.sortBy === key && (
                        sortConfig.sortOrder === 'ASC' ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )
                      )}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="flex justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm mr-3">
                          {user.firstName.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{user.firstName} {user.lastName}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        user.isActive
                          ? 'bg-success/10 text-success border-success/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10">
            <div className="text-sm text-muted-foreground">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} results
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 text-sm font-medium border border-input rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-2xl border border-border">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h3 className="text-xl font-bold text-foreground">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {editingUser ? 'Password (leave empty to keep current)' : 'Password'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  >
                    <option value={Role.PLATFORM_OWNER}>Platform Owner</option>
                    <option value={Role.OPERATION}>Operation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                  <select
                    value={formData.isActive ? 'Active' : 'Inactive'}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'Active' })}
                    className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-muted/20"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              {formError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20">
                  {formError}
                </div>
              )}
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-bold text-white bg-primary hover:bg-primary-dark rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
