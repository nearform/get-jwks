import Cache from './cache';
import * as undici from "undici-types";

type GetPublicKeyOptions = {
  domain?: string
  alg?: string
  kid?: string
}

type JWKSignature = { domain: string; alg: string; kid: string }
type JWK = { [key: string]: any; domain: string; alg: string; kid: string }

type GetJwks = {
  generateCacheKey: (alg: string, kid: string, normalizedDomain: string) => string
  getPublicKey: (options?: GetPublicKeyOptions) => Promise<string>
  getJwk: (signature: JWKSignature) => Promise<JWK>
  getJwksUri: (normalizedDomain: string) => Promise<string>
  cache: Cache<string, JWK>
  staleCache: Cache<string, JWK>
}

type GetJwksOptions = {
  max?: number
  ttl?: number
  issuersWhitelist?: string[]
  providerDiscovery?: boolean
  jwksPath?: string
  fetchOptions?: undici.RequestInit
}

declare namespace buildGetJwks {
  export type { JWKSignature, JWK, GetPublicKeyOptions, GetJwksOptions, GetJwks }
}

declare function buildGetJwks(options?: GetJwksOptions): GetJwks
export = buildGetJwks