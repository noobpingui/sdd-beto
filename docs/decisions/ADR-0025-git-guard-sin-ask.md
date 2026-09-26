# ADR-0025 — El git-guard no pide confirmación a la sesión principal

- **Estado:** Aceptada · 2026-09-26
- **Decidido por:** usuario (opción (a) del hallazgo H5 de la Fase 6)
- **Sustituye:** la parte de la ADR-0008 que hacía que `git commit` y `git push` de la sesión principal devolvieran `ask`
- **Documentación consultada:** `hooks` (*PreToolUse decision control*, *PermissionRequest*) y `headless` (Claude Code v2.1.283)

## Contexto
La ADR-0008 hacía que el git-guard respondiera `ask` a `git commit` y `git push` de la sesión principal, como segunda barrera detrás del gate del chat. La prueba en seco ([`06-prueba-en-seco.md`](../06-prueba-en-seco.md), H5 y H7) mostró tres problemas:
- **Sin interfaz, `ask` equivale a denegar.** En `claude -p`, en el Agent SDK o en cualquier sesión que no pueda mostrar un aviso, ningún commit del flujo sale adelante. El hook `PermissionRequest` no llega a ejecutarse para esos `ask`, así que no hay forma de aprobarlos desde fuera.
- **Doble aprobación en una sesión interactiva.** El usuario aprueba el commit en el chat, con los archivos, el resumen y el mensaje delante, y después vuelve a aprobarlo en un aviso que solo muestra el comando.
- **Asimetría.** `git merge`, que también crea un commit, y además en la rama base, no pasaba por el `ask`.

## Decisión
- En la **sesión principal**, el git-guard **no toma ninguna decisión**: los comandos git siguen el flujo normal de permisos de Claude Code (modo de permisos y reglas `allow`/`ask`/`deny` del usuario).
- **La aprobación de un commit o un push es la del gate del chat**, como exige el protocolo (§4): archivos, resumen y mensaje, o ramas y commits, más un "aprobado" explícito.
- **Para los subagentes no cambia nada:** solo pueden usar git de lectura, y cualquier otro subcomando se deniega.

## Consecuencias
- (+) El flujo funciona en sesiones sin interfaz y cada commit se aprueba una sola vez.
- (+) Desaparece la asimetría entre `commit`/`push` y `merge`.
- (−) Si el orquestador se saltara el gate del chat, ya no habría una segunda barrera del plugin. Lo mitigan:
  - el protocolo y las skills, que exigen el gate antes de cada commit y push;
  - `state.json`, que registra cada aprobación con el texto literal del usuario (`sdd-state approve --note`);
  - los permisos del propio usuario: en el modo por defecto, Claude Code sigue pidiendo permiso para `git commit` y `git push`, salvo que el usuario los haya autorizado.
- Quien quiera una confirmación nativa puede añadir una regla `ask` para `Bash(git commit *)` y `Bash(git push *)` en sus settings; es una decisión de cada usuario, no del plugin.
