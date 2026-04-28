import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function createTask(formData: FormData) {
  "use server";

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!title) {
    return;
  }

  await prisma.task.create({
    data: {
      title,
      description: description || null,
    },
  });

  revalidatePath("/");
}

export default async function Home() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <main style={{ margin: "2rem auto", maxWidth: 720, padding: "0 1rem" }}>
      <h1>Full-Stack MVP Foundation</h1>
      <p>Next.js App Router + Prisma + SQLite baseline.</p>

      <form action={createTask} style={{ display: "grid", gap: 8, marginTop: 20 }}>
        <input name="title" placeholder="Task title" required />
        <textarea name="description" placeholder="Optional description" rows={4} />
        <button type="submit" style={{ width: 180 }}>
          Create task
        </button>
      </form>

      <section style={{ marginTop: 28 }}>
        <h2>Recent Tasks</h2>
        {tasks.length === 0 ? <p>No tasks yet.</p> : null}
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong>
              {task.description ? ` - ${task.description}` : ""}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
