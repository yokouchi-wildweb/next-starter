# 🧩 Shadcn + Zod + React Hook Form におけるバリデーション表示

## ✅ 問題1：バリデーションエラーが表示されない

### ◼ 原因

- `FormMessage` に `error.message` が `undefined` として渡っていた
- これは React Hook Form 側で `undefined` のままフィールドが扱われていたため
- Zod に `min()` を指定していても `"Required"` などのデフォルトエラーが表示されていた

### ◼ 解決方法

#### ① `shouldUnregister: false` を指定する

```ts
const methods = useForm<EventPostFields>({
  resolver: zodResolver(EventPostSchema),
  mode: "onSubmit",
  shouldUnregister: false,
});
```

#### ② defaultValues を必ず指定する

```ts
const methods = useForm<EventPostFields>({
  resolver: zodResolver(EventPostSchema),
  mode: "onSubmit",
  shouldUnregister: false,
  defaultValues: {
    title: "",
    description: "",
    location: "",
    deadline: "",
  },
});
```

#### ② defaultValues を必ず指定する

```ts
const methods = useForm<EventPostFields>({
  resolver: zodResolver(EventPostSchema),
  mode: "onSubmit",
  shouldUnregister: false,
  defaultValues: {
    title: "",
    description: "",
    location: "",
    deadline: "",
  },
});
```
