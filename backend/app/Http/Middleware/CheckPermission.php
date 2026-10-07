<?php

namespace App\Http\Middleware;

use App\Services\PermissionResolver;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Middleware optionnel pour routes Laravel classiques.
 * L'API GRH utilise des gardes inline dans routes/api.php avec les memes regles.
 */
class CheckPermission
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$permissions
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Token manquant'], 401);
        }
        if (!empty($permissions) && !PermissionResolver::hasAny($user, $permissions)) {
            return response()->json([
                'error' => 'Permission refusee',
                'required' => $permissions,
            ], 403);
        }

        return $next($request);
    }
}
