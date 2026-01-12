# userProfile Domain

## Overview
- purpose: role-specific profile management for roles with hasProfile: true
- source_of_truth: src/config/app/roles.config.ts
- current_roles_with_profile: contributor

## Architecture

### Config (roles.config.ts)
```
ADDITIONAL_ROLES[] -> {
  id, label, category, hasProfile, description,
  profileFields?: ProfileFieldConfig[]
}
```

### ProfileFieldConfig (domain.json compatible)
```
name: string           # DB column name (camelCase)
label: string          # display label
formInput: ProfileFormInputType  # textInput, textarea, hidden, switchInput, etc.
fieldType?: string     # string, number, boolean, array, date
required: boolean
showOnRegistration: boolean  # show in registration form
placeholder?, description?, options?, readonly?
```

### Table Structure (per role)
```
entities/tables/{role}Profile.ts

system_fields (not in profileFields):
  - id: uuid PK
  - userId: uuid FK unique -> UserTable.id (cascade delete)
  - createdAt, updatedAt: timestamp

profile_fields (from profileFields):
  - user-editable: formInput = appropriate type
  - admin-only: formInput = "hidden"
```

### Approval Workflow
```
fields:
  - isApproved: boolean (default false)
  - approvedAt: timestamp nullable
  - approvalNote: text nullable

states:
  - approvedAt = null           -> pending (not reviewed)
  - isApproved = true + approvedAt  -> approved
  - isApproved = false + approvedAt -> rejected
```

## Service Structure

```
services/server/
  bases/{role}ProfileBase.ts     # createCrudService + userId methods
  operations/*.ts                # getProfile, upsertProfile, etc.
  registry.ts                    # role -> base mapping
  userProfileService.ts          # public API (re-export operations)
```

### Base Pattern
```typescript
const base = createCrudService(Table, {
  idType: "uuid",
  useCreatedAt: true,
  useUpdatedAt: true,
  defaultUpsertConflictFields: ["userId"],
});

export const xxxProfileBase = {
  ...base,
  getByUserId,      // custom
  existsByUserId,   // custom
  updateByUserId,   // custom
  removeByUserId,   # custom
};
```

### Registry Pattern
```typescript
PROFILE_BASE_REGISTRY: Record<string, ProfileBase> = {
  contributor: contributorProfileBase,
  // add new roles here
};

getProfileBase(role): ProfileBase | null
```

### Operations (role-agnostic via registry)
- getProfile(userId, role)
- upsertProfile(userId, role, data)
- updateProfile(userId, role, data)
- deleteProfile(userId, role)
- setApprovalStatus(userId, role, isApproved, note?)
- hasProfile(role)

## Adding New Role Profile

1. roles.config.ts: add role with hasProfile: true, profileFields: [...]
2. entities/tables/: copy _template.ts.example, define columns
3. entities/drizzle.ts: re-export table and types
4. services/server/bases/: create {role}ProfileBase.ts
5. services/server/registry.ts: add to PROFILE_BASE_REGISTRY
6. drizzle-kit push: update DB schema

## File Locations

```
src/features/core/userProfile/
  entities/
    tables/
      _template.ts.example
      contributorProfile.ts
    drizzle.ts
  services/
    server/
      bases/
        contributorProfileBase.ts
      operations/
        getProfile.ts
        upsertProfile.ts
        updateProfile.ts
        deleteProfile.ts
        setApprovalStatus.ts
        hasProfile.ts
      registry.ts
      userProfileService.ts
      index.ts
```

## Related Files
- src/config/app/roles.config.ts: role definitions
- src/features/core/user/constants/role.ts: role utilities
- src/components/Form/DomainFieldRenderer/: form rendering (profileFields compatible)
