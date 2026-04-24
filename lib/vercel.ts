export async function addSubdomain(subdomain: string) {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    console.error("Vercel token or project ID is missing");
    return { error: "Vercel credentials missing" };
  }

  try {
    const res = await fetch(\`https://api.vercel.com/v10/projects/\${projectId}/domains\`, {
      method: "POST",
      headers: {
        "Authorization": \`Bearer \${token}\`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: \`\${subdomain}.oneflash.one\` }),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("Failed to add domain to Vercel", error);
      return { error: error.message || "Failed to add domain" };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error adding domain to Vercel", error);
    return { error: "Internal server error adding domain" };
  }
}

export async function removeSubdomain(subdomain: string) {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;

  if (!token || !projectId) {
    console.error("Vercel token or project ID is missing");
    return { error: "Vercel credentials missing" };
  }

  try {
    const res = await fetch(\`https://api.vercel.com/v10/projects/\${projectId}/domains/\${subdomain}.oneflash.one\`, {
      method: "DELETE",
      headers: {
        "Authorization": \`Bearer \${token}\`,
      },
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("Failed to remove domain from Vercel", error);
      return { error: error.message || "Failed to remove domain" };
    }

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error("Error removing domain from Vercel", error);
    return { error: "Internal server error removing domain" };
  }
}
