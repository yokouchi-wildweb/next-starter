      <FormFieldItem
        control={control}
        name={"__fieldName__" as FieldPath<TFieldValues>}
        label="__label__"
        renderInput={(field) => (
          <BooleanRadioGroupInput field={field} options={__options__} />
        )}
      />
