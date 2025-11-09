  const { upload: __uploadHandler__, remove: __deleteHandler__, markDeleted: __markDeletedHandler__ } =
    useImageUploaderField(methods, "__fieldName__", "__uploadPath__");
  useRouteChangeEffect(() => {
    const url = methods.getValues("__fieldName__");
    if (!url) return;
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify({ pathOrUrl: url })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/storage/delete", blob);
    } else {
      void __deleteHandler__(url);
    }
    __markDeletedHandler__();
  });

