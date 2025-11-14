      <FormField
        control={control}
        name={"__fieldName__" as FieldPath<TFieldValues>}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <SwitchInput field={field} label="__label__" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
