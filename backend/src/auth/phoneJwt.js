import jwt from 'jsonwebtoken';

export function signPhoneJwt(phone) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('JWT_SECRET must be set (min 16 chars)');
  }
  return jwt.sign({ phone }, secret, { expiresIn: '7d' });
}

export function verifyPhoneJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  const payload = jwt.verify(token, secret);
  if (!payload.phone || typeof payload.phone !== 'string') {
    throw new Error('Invalid token payload');
  }
  return { phone: payload.phone };
}
