import io.github.treesitter.jtreesitter.Language;
import io.github.treesitter.jtreesitter.mlir.TreeSitterMlir;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

public class TreeSitterMlirTest {
    @Test
    public void testCanLoadLanguage() {
        assertDoesNotThrow(() -> new Language(TreeSitterMlir.language()));
    }
}
