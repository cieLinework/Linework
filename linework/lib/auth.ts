import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'linework-secret-change-me'
)
const COOKIE_NAME = 'linework_session'

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10)
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash)
}

export async function createSession(user: {
  id: string; name: string; initials: string; color: string; is_admin: boolean
}) {
  const token = await new SignJWT({ 
    sub: user.id,
    name: user.name,
    initials: user.initials,
    color: user.color,
    isAdmin: user.is_admin
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(JWT_SECRET)

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  })

  return token
}

export async function getSession() {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as {
      sub: string; name: string; initials: string; color: string; isAdmin: boolean
    }
  } catch {
    return null
  }
}

export async function clearSession() {
  cookies().delete(COOKIE_NAME)
}
