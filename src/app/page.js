"use client";
import { Button } from "antd";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    await router.push(`/${Math.floor(Math.random() * 10000)}`);
    setLoading(false);
  };

  // useEffect(() => {
  //   const lastRoomId = localStorage.getItem("lastRoomId");
  //   if (lastRoomId) {
  //     router.push(`/${lastRoomId}`);
  //   }
  // }, []);

  return (
    <div className=" h-screen flex justify-center flex-col gap-6 items-center">
      <div className=" text-4xl">Live NotePad</div>
      <Button
        loading={loading}
        disabled={loading}
        type="primary"
        size="small"
        onClick={handleCreateRoom}
      >
        Create Room
      </Button>
    </div>
  );
}

export default Page;
