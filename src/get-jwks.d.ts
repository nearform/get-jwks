import LRU from 'lru-cache'

type JWKSignature = { domain: string; alg: string; kid: string }
type JWK = { [key: string]: any; domain: string; alg: string; kid: string }

type GetJwks = {
  getPublicKey: (options?: {
    domain?: string
    alg?: string
    kid?: string
  }) => Promise<string>
  getJwk: (signature: JWKSignature) => Promise<JWK>
  getJwksUri: (normalizedDomain: string) => Promise<string>
  catch: LRU<string, JWK>
  staleCache: LRU<string, JWK>
}

export default function buildGetJwks(options?: {
  max?: number
  maxAge?: number
  allowedDomains?: string[]
  providerDiscovery?: boolean
  jwksPath?: string
  agent?: string
}): GetJwks
