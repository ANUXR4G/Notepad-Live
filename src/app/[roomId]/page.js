// "use client";

// import { UploadIcon, DownloadIcon } from "@radix-ui/react-icons";
// import { Button, Upload, message } from "antd";
// import { useParams } from "next/navigation";
// import { useEffect, useState } from "react";
// import { io } from "socket.io-client";

// const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL);

// export default function Home() {
//   const [isConnected, setIsConnected] = useState(false);
//   const [messageText, setMessageText] = useState("");
//   const [file, setFile] = useState(null); // Hold the single file
//   const { roomId } = useParams();

//   const [isClipboardSupported, setIsClipboardSupported] = useState(false);

//   useEffect(() => {
//     // Check if clipboard API is available
//     if (typeof navigator !== "undefined" && navigator.clipboard) {
//       setIsClipboardSupported(true);
//     }
//   }, []);

//   const copyToClipboard = (text) => {
//     if (isClipboardSupported) {
//       // Use the modern clipboard API
//       navigator.clipboard
//         .writeText(text)
//         .then(() => {
//           alert("Copied URL to clipboard");
//         })
//         .catch((err) => {
//           console.error("Failed to copy text: ", err);
//           alert("Failed to copy text");
//         });
//     } else {
//       // Fallback to the older method
//       const textArea = document.createElement("textarea");
//       textArea.value = text;
//       document.body.appendChild(textArea);
//       textArea.select();
//       try {
//         document.execCommand("copy");
//         message.success("Copied URL to clipboard");
//       } catch (err) {
//         console.error("Fallback: Oops, unable to copy", err);
//         message.error("Failed to copy text");
//       } finally {
//         document.body.removeChild(textArea);
//       }
//     }
//   };

//   const handleCopyUrl = () => {
//     const url = window.location.href;
//     copyToClipboard(url);
//   };

//   useEffect(() => {
//     socket.on("connect", () => {
//       setIsConnected(true);
//       socket.emit("join-room", roomId);
//     });

//     socket.on("receive-text", (newText) => {
//       setMessageText(newText);
//     });

//     socket.on("receive-file", (fileData) => {
//       setFile(fileData); // Only one file is set at a time
//     });

//     socket.on("room-data", (roomData) => {
//       setMessageText(roomData.text);
//       setFile(roomData.files[0]); // Handle single file from array
//     });

//     return () => {
//       socket.off("connect");
//       socket.off("receive-text");
//       socket.off("receive-file");
//       socket.emit("leave-room", roomId);
//     };
//   }, [roomId]);

//   const handleTextChange = (e) => {
//     const newText = e.target.value;
//     setMessageText(newText);
//     if (isConnected) {
//       socket.emit("text-update", roomId, newText);
//     }
//   };

//   const handleFileUpload = (file) => {
//     const reader = new FileReader();
//     reader.onload = () => {
//       const fileData = reader.result;
//       if (isConnected) {
//         socket.emit("file-upload", roomId, file.name, fileData);
//         message.success(`File uploaded: ${file.name}`);
//       }
//     };
//     reader.readAsArrayBuffer(file);
//     return false; // Prevent default behavior
//   };

//   return (
//     <div className="min-h-screen relative">
//       <Button className="fixed top-6 right-6" onClick={handleCopyUrl}>
//         Copy URL
//       </Button>

//       <div className="border fixed right-3 bottom-3 flex gap-5 items-center rounded-md p-3">
//         <Upload
//           beforeUpload={handleFileUpload}
//           showUploadList={false}
//           multiple={false} // Only single file is allowed
//         >
//           <Button icon={<UploadIcon />} shape="default">
//             Upload File
//           </Button>
//         </Upload>

//         {file ? (
//           <a href={file.filePath} target="_top" download={file.fileName}>
//             <Button icon={<DownloadIcon />} shape="default">
//               Download {file.fileName}
//             </Button>
//           </a>
//         ) : (
//           <p>No file uploaded yet</p> // Fallback if no file is available
//         )}
//       </div>

//       <textarea
//         placeholder="Enter your message..."
//         onChange={handleTextChange}
//         rows={Math.floor(window.innerHeight / 14)}
//         className="p-10 w-full h-full text-black outline-none"
//         value={messageText}
//       />
//     </div>
//   );
// }


"use client";

import { UploadIcon, DownloadIcon } from "@radix-ui/react-icons";
import { Button, Upload, message } from "antd";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ref, onValue, set } from "firebase/database";
import { database, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
const deleteAfterTwoDays = 2 * 24 * 60 * 60 * 1000; // Two days in milliseconds

export default function Home() {
  const [messageText, setMessageText] = useState("");
  const [file, setFile] = useState(null); // Hold the single file
  const { roomId } = useParams();
  localStorage.setItem("lastRoomId", roomId);

  const [isClipboardSupported, setIsClipboardSupported] = useState(false);

  useEffect(() => {
    // Check if clipboard API is available
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      setIsClipboardSupported(true);
    }
  }, []);

  const copyToClipboard = (text) => {
    if (isClipboardSupported) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          alert("Copied URL to clipboard");
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
          alert("Failed to copy text");
        });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        message.success("Copied URL to clipboard");
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
        message.error("Failed to copy text");
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const handleCopyUrl = () => {
    const url = window.location.href;
    copyToClipboard(url);
  };

  useEffect(() => {
    const messageRef = ref(database, `rooms/${roomId}/messageText`);
    const fileRef = ref(database, `rooms/${roomId}/file`);
    
    const currentTime = Date.now();
  
    const unsubscribeMessage = onValue(messageRef, (snapshot) => {
      if (snapshot.exists()) {
        const { text, timestamp } = snapshot.val();
        if (currentTime - timestamp > deleteAfterTwoDays) {
          // Data is older than two days, so delete it
          remove(messageRef);
        } else {
          setMessageText(text);
        }
      }
    });
  
    const unsubscribeFile = onValue(fileRef, (snapshot) => {
      if (snapshot.exists()) {
        const { fileName, filePath, timestamp } = snapshot.val();
        if (currentTime - timestamp > deleteAfterTwoDays) {
          // File is older than two days, so delete it
          remove(fileRef);
        } else {
          setFile({ fileName, filePath });
        }
      }
    });
  
    return () => {
      unsubscribeMessage();
      unsubscribeFile();
    };
  }, [roomId]);
  
  const handleTextChange = (e) => {
    const newText = e.target.value;
    const timestamp = Date.now(); // Get the current timestamp
  
    setMessageText(newText);
    // Update the message text and timestamp in Firebase
    set(ref(database, `rooms/${roomId}/messageText`), {
      text: newText,
      timestamp: timestamp,
    });
  };
  
  const handleFileUpload = (file) => {
    const fileName = file.name;
    const storageReference = storageRef(storage, `rooms/${roomId}/${fileName}`); // Storage path

    // Upload file to Firebase Storage
    uploadBytes(storageReference, file).then((snapshot) => {
      // Get download URL after the file is uploaded
      getDownloadURL(snapshot.ref).then((url) => {
        // Save file metadata in Firebase Realtime Database
        set(databaseRef(database, `rooms/${roomId}/file`), {
          fileName: fileName,
          fileUrl: url,
        });
        message.success(`File uploaded: ${fileName}`);
        setFile({ fileName, fileUrl: url });
      });
    }).catch((error) => {
      message.error(`File upload failed: ${error.message}`);
    });

    return false; // Prevent default behavior
  };
  return (
    <div className="min-h-screen relative">
      <Button className="fixed top-4 right-4" onClick={handleCopyUrl}>
        Copy URL
      </Button>

      {/* <div className="border fixed right-3 bottom-3 flex gap-5 items-center rounded-md p-3">
        <Upload
          beforeUpload={handleFileUpload}
          showUploadList={false}
          multiple={false} // Only single file is allowed
        >
          <Button icon={<UploadIcon />} shape="default">
            Upload File
          </Button>
        </Upload>

        {file ? (
          <a href={file.filePath} target="_top" download={file.fileName}>
            <Button icon={<DownloadIcon />} shape="default">
              Download {file.fileName}
            </Button>
          </a>
        ) : (
          <p>No file uploaded yet</p> // Fallback if no file is available
        )}
      </div> */}

      <textarea
        placeholder="Enter your message..."
        onChange={handleTextChange}
        rows={Math.floor(window.innerHeight / 14)}
        className="px-10 py-20 w-full h-full text-black outline-none"
        value={messageText}
      />
    </div>
  );
}
