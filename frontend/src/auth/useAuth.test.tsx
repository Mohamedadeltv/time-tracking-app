import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useAuth } from './useAuth'

describe('useAuth', () => {
  it('throws when used outside an AuthProvider', () => {
    function Bare() {
      useAuth()
      return null
    }
    expect(() => render(<Bare />)).toThrow('useAuth must be used within an AuthProvider')
  })
})
