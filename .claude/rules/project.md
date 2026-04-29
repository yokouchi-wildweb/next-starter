# project

## ROLE
type: upstream template (base for many forked projects)
direct_users: minimal — this repo itself has few end users
downstream: many derivative projects depend on this as their base

## IMPLICATIONS
- changes propagate to all downstream forks; high blast radius
- favor generality and extensibility over project-specific shortcuts
- preserve extension points; avoid hardcoding for any single use case
