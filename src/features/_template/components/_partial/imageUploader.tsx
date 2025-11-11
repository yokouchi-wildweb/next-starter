      <FormFieldItem
        control={control}
        name={"__fieldName__" as FieldPath<TFieldValues>}
        label="__label__"
        renderInput={(field) => (
          <FileUrlInput
            field={field as any}
            accept="image/*"
            initialUrl={__name__ ?? undefined}
            onUpload={__uploadHandler__}
            onDelete={__deleteHandler__}
            onPendingChange={onPendingChange}
          />
        )}
      />
