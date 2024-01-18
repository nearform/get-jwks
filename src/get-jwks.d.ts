import type { LRUCache } from 'lru-cache'
import type { Agent } from 'https'

export type JWKSignature = { domain: string; alg: string; kid: string }
export type JWK = { [key: string]: any; domain: string; alg: string; kid: string }

export type GetPublicKeyOptions = {
  domain?: string
  alg?: string
  kid?: string
}

export type GetJwksOptions = {
  max?: number
  ttl?: number
  issuersWhitelist?: string[]
  providerDiscovery?: boolean
  jwksPath?: string
  agent?: Agent
  timeout?: number
}

export type GetJwks = {
  getPublicKey: (options?: GetPublicKeyOptions) => Promise<string>
  getJwk: (signature: JWKSignature) => Promise<JWK>
  getJwksUri: (normalizedDomain: string) => Promise<string>
  cache: LRUCache<string, JWK>
  staleCache: LRUCache<string, JWK>
}

export default function buildGetJwks(options?: GetJwksOptions): GetJwks
