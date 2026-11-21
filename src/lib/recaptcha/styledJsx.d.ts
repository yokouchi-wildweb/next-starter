// src/lib/recaptcha/styledJsx.d.ts
//
// Next に同梱の styled-jsx の <style jsx global> の属性(この lib が使う形だけ)。
// アプリの型検査では next の型(next-env.d.ts)が同じものを足す。単体用 tsconfig は next の型を読まないのでここで宣言する
import "react";

declare module "react" {
  interface StyleHTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}
