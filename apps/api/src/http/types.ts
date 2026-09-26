import type {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
} from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Role } from '@edventure/contracts';
import type { Actor } from '../platform/actor';
import type { ResolvedSession } from '../modules/identity/service';

export type App = FastifyInstance<
  RawServerDefault,
  RawRequestDefaultExpression<RawServerDefault>,
  RawReplyDefaultExpression<RawServerDefault>,
  FastifyBaseLogger,
  ZodTypeProvider
>;

/**
 * - `public`: no authentication (login, health, templates).
 * - `session`: signed in, even if a password change or MFA step is still pending.
 * - `full` (default): signed in with every required step complete.
 */
export type AuthMode = 'public' | 'session' | 'full';

declare module 'fastify' {
  interface FastifyContextConfig {
    auth?: AuthMode;
    /** Any of these roles grants access to the route (fine-grained scope checks happen in services). */
    roles?: Role[];
  }
  interface FastifyRequest {
    session: ResolvedSession | null;
    accessToken: string | null;
    authViaCookie: boolean;
    /** The verified caller. Throws if the route is public. */
    readonly actor: Actor;
  }
}
