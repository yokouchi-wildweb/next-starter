      <FormField
        control={control}
        name={"__fieldName__" as FieldPath<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <StepperInput
                label="__label__"
                value={typeof field.value === "number" ? field.value : Number(field.value ?? 0)}
                className="w-fit"
                onValueChange={(value) => field.onChange(value)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
