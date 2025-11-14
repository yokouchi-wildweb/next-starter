      <FormFieldItem
        control={control}
        name={"__fieldName__" as FieldPath<TFieldValues>}
        label="__label__"
        renderInput={(field) => (
          <Checkbox checked={field.value ?? false} onCheckedChange={(v) => field.onChange(!!v)} />
        )}
      />
