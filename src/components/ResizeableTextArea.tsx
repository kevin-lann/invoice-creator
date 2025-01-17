import { useFormContext, UseFormRegister } from "react-hook-form"
import { Invoice } from "../models/Invoice";
import { ChangeEvent, useEffect, useRef } from "react";

interface ResizeableTextAreaProps {
  register: UseFormRegister<any>;
  registerValue: string;
}

const ResizeableTextArea = ({
  register,
  registerValue,
}: ResizeableTextAreaProps) => {

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  return (
    <textarea
      {...register(registerValue)}
      onInput={handleInput}
      className={`hide-scrollbar text-slate-800 text-sm outline-none py-1 px-2 hover:bg-slate-100 hover:py-2 placeholder:italic placeholder:text-gray-500 border border-2 border-gray-100 resize-none`}
    />
  );
}

export default ResizeableTextArea