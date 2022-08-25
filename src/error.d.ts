import type { Response } from 'node-fetch'

export enum errorCode {
  OPENID_CONFIGURATION_REQUEST_FAILED = 'OPENID_CONFIGURATION_REQUEST_FAILED',
  JWKS_REQUEST_FAILED = 'JWKS_REQUEST_FAILED',
  NO_JWKS_URI = 'NO_JWKS_URI',
  NO_JWKS = 'NO_JWKS',
  JWK_NOT_FOUND = 'JWK_NOT_FOUND',
  DOMAIN_NOT_ALLOWED = 'DOMAIN_NOT_ALLOWED',
}

declare class GetJwksError extends Error {
  code: errorCode
  response: Response
  body: unknown

  constructor(
    code: errorCode,
    requestProperties?: { response: Response; body: unknown }
  )
}
