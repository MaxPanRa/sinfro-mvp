import type { CSSProperties, ReactNode } from "react";

const LAST_UPDATED = "junio de 2026";
const CONTACT_EMAIL = "maxpanra@gmail.com";

function storedTheme() {
  return localStorage.getItem("sinfron.theme") || "esmeralda";
}

function storedAccent() {
  const accent = localStorage.getItem("sinfron.accent");
  return accent && accent.startsWith("#") ? accent : "#10A37F";
}

export function LegalView({ type }: { type: "privacy" | "terms" }) {
  const wrapperStyle = {
    minHeight: "100vh",
    background: "var(--bg)",
    color: "var(--text)",
    "--accent": storedAccent(),
  } as CSSProperties;

  return (
    <div data-theme={storedTheme()} style={wrapperStyle}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 22px 80px" }}>
        <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(150deg, var(--accent), var(--accent))",
            }}
          >
            SF
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>SinFro</div>
            <div style={{ fontSize: 12, color: "var(--text2)" }}>Asistente de búsqueda de empleo</div>
          </div>
          <a href="/" style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
            ← Volver a la app
          </a>
        </header>

        {type === "privacy" ? <PrivacyContent /> : <TermsContent />}

        <footer style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid var(--border)", fontSize: 12.5, color: "var(--text2)" }}>
          ¿Dudas? Escríbenos a{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: "var(--accent)" }}>
            {CONTACT_EMAIL}
          </a>
          .
        </footer>
      </div>
    </div>
  );
}

function Title({ children }: { children: ReactNode }) {
  return <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px" }}>{children}</h1>;
}

function Updated() {
  return <p style={{ fontSize: 12.5, color: "var(--text2)", margin: "0 0 28px" }}>Última actualización: {LAST_UPDATED}</p>;
}

function H2({ children }: { children: ReactNode }) {
  return <h2 style={{ fontSize: 17, fontWeight: 600, margin: "28px 0 8px" }}>{children}</h2>;
}

function P({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text1)", margin: "0 0 10px" }}>{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul style={{ fontSize: 14, lineHeight: 1.65, color: "var(--text1)", margin: "0 0 10px", paddingLeft: 20 }}>{children}</ul>;
}

function PrivacyContent() {
  return (
    <article>
      <Title>Política de Privacidad</Title>
      <Updated />

      <P>
        Esta Política de Privacidad describe cómo SinFro ("la aplicación", "nosotros") recopila, usa y protege tu
        información cuando utilizas el servicio. Al usar SinFro aceptas las prácticas aquí descritas.
      </P>

      <H2>1. Información que recopilamos</H2>
      <UL>
        <li><strong>Datos de cuenta:</strong> nombre y correo electrónico, ya sea por registro directo o mediante el inicio de sesión con Google.</li>
        <li><strong>Datos de perfil:</strong> la información que ingresas en tus perfiles de búsqueda (rol, ubicación, idiomas, palabras clave, habilidades y descripción).</li>
        <li><strong>Currículum (CV):</strong> cuando subes un CV para análisis, el archivo se procesa para extraer habilidades y un resumen. En el plan gratuito el análisis es local y <strong>el archivo no se almacena</strong>; solo se guardan los datos resultantes que decides conservar en tu perfil.</li>
        <li><strong>Datos de uso:</strong> vacantes detectadas, estados (vista, aplicada, descartada) y registros de sincronización asociados a tu cuenta.</li>
        <li><strong>Preferencias:</strong> tema, color de acento y densidad de la interfaz.</li>
      </UL>

      <H2>2. Acceso a datos de tu cuenta de Google</H2>
      <P>
        SinFro accede a datos de tu cuenta de Google únicamente con tu autorización explícita y solo para las funciones
        descritas a continuación:
      </P>
      <UL>
        <li>
          <strong>Inicio de sesión (perfil básico):</strong> al autenticarte con Google accedemos a tu nombre y correo
          electrónico para crear o identificar tu cuenta.
        </li>
        <li>
          <strong>Envío de correos (Gmail — alcance <code>gmail.send</code>):</strong> si lo autorizas, usamos este permiso
          <strong> exclusivamente para enviar correos electrónicos en tu nombre</strong> (por ejemplo, resúmenes de vacantes a
          tus propios destinatarios). No leemos, modificamos ni eliminamos los mensajes de tu bandeja, y no usamos este acceso
          para ningún otro propósito.
        </li>
      </UL>

      <H2>3. Uso limitado de datos de Google (Limited Use)</H2>
      <P>
        El uso y la transferencia que SinFro hace de la información recibida de las API de Google se ajusta a la{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
          Política de Datos de Usuario de los Servicios de API de Google
        </a>
        , incluidos sus requisitos de Uso Limitado (Limited Use). En particular:
      </P>
      <UL>
        <li>Usamos los datos obtenidos de las API de Google solo para proveer y mejorar las funciones que tú solicitaste.</li>
        <li>No transferimos esos datos a terceros, salvo cuando sea necesario para prestar la función, por requerimiento legal, o como parte de una fusión o adquisición con tu consentimiento.</li>
        <li>No usamos esos datos con fines de publicidad.</li>
        <li>No usamos esos datos para entrenar ni mejorar modelos de inteligencia artificial o aprendizaje automático generalizados.</li>
        <li>Ninguna persona lee tus datos de Google, salvo que cuentes con tu consentimiento expreso, sea necesario por seguridad (p. ej. investigar abusos), lo exija la ley, o se trate de datos agregados y anonimizados para operaciones internas.</li>
      </UL>

      <H2>4. Cómo usamos tu información</H2>
      <UL>
        <li>Para operar el servicio: autenticación, gestión de perfiles y evaluación de vacantes.</li>
        <li>Para analizar tu CV y sugerir habilidades y palabras clave.</li>
        <li>Para enviarte notificaciones relacionadas con tu cuenta (por ejemplo, verificación de correo).</li>
      </UL>

      <H2>5. Credenciales de terceros (BYOK)</H2>
      <P>
        SinFro permite conectar tus propias llaves de servicios externos (modelos de IA, búsqueda y bolsas de empleo). Estas
        credenciales se almacenan <strong>cifradas</strong> y se usan solo para ejecutar las funciones que solicitas. Eres
        responsable del uso y los costos de tus propias cuentas con dichos proveedores.
      </P>

      <H2>6. Almacenamiento y seguridad</H2>
      <P>
        Tus datos se almacenan en nuestra base de datos y aplicamos medidas razonables para protegerlos. Usamos
        almacenamiento local del navegador para tu sesión y tus preferencias de interfaz. Ningún sistema es 100% seguro, pero
        trabajamos para resguardar tu información.
      </P>

      <H2>7. Compartir información</H2>
      <P>
        No vendemos tu información personal. Solo se comparten datos con los proveedores externos que tú conectas (BYOK)
        cuando ejecutas funciones que los requieren, y con servicios de infraestructura necesarios para operar la aplicación.
      </P>

      <H2>8. Tus derechos</H2>
      <P>
        Puedes editar o eliminar tus perfiles desde la aplicación. Al eliminar un perfil también se eliminan las vacantes
        asociadas a tu cuenta. Si deseas eliminar tu cuenta o solicitar el borrado de tus datos, escríbenos al correo de
        contacto.
      </P>

      <H2>9. Cambios a esta política</H2>
      <P>Podemos actualizar esta política. Publicaremos los cambios en esta página con su fecha de actualización.</P>

      <H2>10. Contacto</H2>
      <P>Para cualquier duda sobre privacidad, escríbenos a {CONTACT_EMAIL}.</P>
    </article>
  );
}

function TermsContent() {
  return (
    <article>
      <Title>Condiciones del Servicio</Title>
      <Updated />

      <P>
        Estas Condiciones del Servicio rigen el uso de SinFro. Al crear una cuenta o usar la aplicación aceptas estos
        términos. Si no estás de acuerdo, no utilices el servicio.
      </P>

      <H2>1. Descripción del servicio</H2>
      <P>
        SinFro es un asistente para buscar y evaluar vacantes de empleo. Permite crear perfiles, analizar tu CV y revisar
        vacantes. Es un producto en desarrollo y sus funciones pueden cambiar.
      </P>

      <H2>2. Cuenta y uso aceptable</H2>
      <UL>
        <li>Eres responsable de la seguridad de tu cuenta y de la información que proporcionas.</li>
        <li>Te comprometes a usar el servicio de forma legal y a no abusar de las fuentes de datos ni de la infraestructura.</li>
        <li>No debes intentar vulnerar, sobrecargar o usar el servicio para fines no autorizados.</li>
      </UL>

      <H2>3. Llaves propias (BYOK)</H2>
      <P>
        Si conectas tus propias credenciales de servicios externos, eres responsable de cumplir los términos de esos
        proveedores y de cualquier costo que generes con ellos. SinFro no se hace responsable por cargos, límites o bloqueos
        derivados del uso de tus llaves.
      </P>

      <H2>4. Disponibilidad y "tal cual"</H2>
      <P>
        El servicio se ofrece "tal cual" y "según disponibilidad", sin garantías de ningún tipo. No garantizamos exactitud de
        las vacantes, resultados de las evaluaciones, disponibilidad continua ni ausencia de errores.
      </P>

      <H2>5. Limitación de responsabilidad</H2>
      <P>
        En la medida que lo permita la ley, SinFro no será responsable por daños indirectos, incidentales o consecuentes
        derivados del uso o la imposibilidad de uso del servicio, incluyendo decisiones tomadas con base en la información
        mostrada.
      </P>

      <H2>6. Propiedad intelectual</H2>
      <P>
        El software, la marca y el diseño de SinFro pertenecen a sus titulares. El contenido que tú ingresas (perfiles, CV,
        datos) sigue siendo tuyo.
      </P>

      <H2>7. Cambios y terminación</H2>
      <P>
        Podemos modificar o descontinuar el servicio, o actualizar estos términos, en cualquier momento. Puedes dejar de usar
        el servicio y solicitar la eliminación de tu cuenta cuando quieras.
      </P>

      <H2>8. Contacto</H2>
      <P>Para cualquier duda sobre estas condiciones, escríbenos a {CONTACT_EMAIL}.</P>
    </article>
  );
}
