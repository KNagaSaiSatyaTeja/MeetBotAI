'use client'

import { useState } from 'react'

interface AvatarProps {
  user?: {
    email?: string
    name?: string
    role?: string
    avatarUrl?: string
  }
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Avatar({ user, size = 'md', className = '' }: AvatarProps) {
  const [imageError, setImageError] = useState(false)
  
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-8 w-8 text-sm',
    lg: 'h-12 w-12 text-lg'
  }
  
  const getInitials = (email?: string, name?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }
    if (email) {
      return email.split('@')[0].slice(0, 2).toUpperCase()
    }
    return 'U'
  }
  
  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-red-500'
      case 'USER':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }
  
  const initials = getInitials(user?.email, user?.name)
  const roleColor = getRoleColor(user?.role)
  
  return (
    <div className={`${sizeClasses[size]} ${className} relative`}>
      {user?.avatarUrl && !imageError ? (
        <img
          src={user.avatarUrl}
          alt={user.name || user.email || 'User'}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className={`w-full h-full rounded-full ${roleColor} flex items-center justify-center text-white font-medium`}>
          {initials}
        </div>
      )}
      
      {/* Role indicator dot */}
      {user?.role && (
        <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${roleColor} rounded-full border-2 border-white`}></div>
      )}
    </div>
  )
}
