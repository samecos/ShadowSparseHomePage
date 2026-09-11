import styles from './page-backdrop.module.css';

type PageBackdropProps = {
  src: string;
  position?: string;
};

export function PageBackdrop({ src, position = 'center 32%' }: PageBackdropProps) {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <img
        className={styles.image}
        src={src}
        alt=""
        decoding="async"
        style={{ objectPosition: position }}
      />
    </div>
  );
}
